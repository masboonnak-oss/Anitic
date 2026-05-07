const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

let TikTokLiveConnection, WebcastEvent;
try {
  const pkg = require('tiktok-live-connector');
  TikTokLiveConnection = pkg.TikTokLiveConnection;
  WebcastEvent = pkg.WebcastEvent;
} catch (e) {
  console.log('tiktok-live-connector not available:', e.message);
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/* ── Image proxy (avoids CORS + TikTok CDN blocks in browser) ── */
app.get('/api/img', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');
  try {
    const r = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.tiktok.com/',
      },
      maxRedirects: 5,
    });
    res.set('Content-Type', r.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(r.data);
  } catch (e) {
    res.status(502).send('proxy error');
  }
});

/* ── In-memory state ── */
const players = new Map();

let liveConnection = null;
let liveHost = null;
let liveStatus = 'disconnected';
let liveError = null;
const commenters = new Map();
const MAX_COMMENTERS = 60;

function broadcast() {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  io.emit('players', sorted);
}

function broadcastLiveStatus() {
  io.emit('liveStatus', { status: liveStatus, host: liveHost, error: liveError, commenterCount: commenters.size });
}

function broadcastCommenters() {
  const list = Array.from(commenters.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_COMMENTERS);
  io.emit('commenters', list);
}

/* ── Proxy a TikTok CDN pic through our server ── */
function proxiedPic(url, username) {
  if (!url) return `https://unavatar.io/tiktok/${username}`;
  // Wrap TikTok CDN URLs through our proxy
  if (url.includes('tiktokcdn') || url.includes('tiktok.com') || url.includes('muscdn')) {
    return `/api/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/* ── TikTok Live connection ── */
function disconnectLive() {
  if (liveConnection) {
    try { liveConnection.disconnect(); } catch (_) {}
    liveConnection = null;
  }
  liveStatus = 'disconnected';
  liveHost = null;
  liveError = null;
  broadcastLiveStatus();
}

function connectLive(username) {
  disconnectLive();

  if (!TikTokLiveConnection) {
    liveStatus = 'error';
    liveError = 'tiktok-live-connector ไม่พร้อมใช้งาน';
    broadcastLiveStatus();
    return;
  }

  liveHost = username;
  liveStatus = 'connecting';
  liveError = null;
  broadcastLiveStatus();

  let conn;
  try {
    conn = new TikTokLiveConnection(username, {
      processInitialData: false,
      fetchRoomInfoOnConnect: false,
      enableExtendedGiftInfo: false,
    });
  } catch (e) {
    liveStatus = 'error';
    liveError = e.message || 'สร้าง connection ไม่ได้';
    broadcastLiveStatus();
    return;
  }

  liveConnection = conn;

  conn.connect()
    .then(() => {
      liveStatus = 'connected';
      liveError = null;
      broadcastLiveStatus();
    })
    .catch((err) => {
      const msg = err?.message || String(err);
      // Detect known IP-block errors
      const isBlocked = msg.includes('Room ID') || msg.includes('sources') || msg.includes('fetch') || msg.includes('Response');
      liveStatus = 'error';
      liveError = isBlocked
        ? 'TikTok บล็อค Cloud Server\nต้องรันแอปบนเครื่องตัวเองเท่านั้น (localhost) — ไม่ใช่ Replit cloud'
        : (msg || 'เชื่อมต่อไม่ได้');
      liveConnection = null;
      broadcastLiveStatus();
    });

  // New API: use WebcastEvent constants or plain strings
  const chatEvent = WebcastEvent?.CHAT || 'chat';
  conn.on(chatEvent, (data) => {
    // New v2.3 data format: data.user.uniqueId, data.comment
    const uid       = data?.user?.uniqueId || data?.uniqueId;
    const nickname  = data?.user?.nickname  || data?.nickname || uid;
    const picRaw    = data?.user?.profilePictureUrl || data?.user?.avatarUrl || data?.profilePictureUrl;
    if (!uid) return;

    const picUrl = proxiedPic(picRaw, uid);
    commenters.set(uid, {
      uniqueId: uid,
      nickname: nickname || uid,
      profilePicUrl: picUrl,
      lastSeen: Date.now(),
      msgCount: (commenters.get(uid)?.msgCount || 0) + 1,
      lastMsg: data?.comment || '',
    });

    io.emit('chatCapture', {
      uniqueId: uid,
      displayName: nickname || uid,
      profilePicUrl: picUrl,
    });

    // Trim excess
    if (commenters.size > MAX_COMMENTERS * 2) {
      const sorted = [...commenters.entries()].sort((a, b) => b[1].lastSeen - a[1].lastSeen);
      commenters.clear();
      sorted.slice(0, MAX_COMMENTERS).forEach(([k, v]) => commenters.set(k, v));
    }
    broadcastCommenters();
  });

  conn.on('disconnected', () => {
    if (liveStatus === 'connected') {
      liveStatus = 'error';
      liveError = 'การเชื่อมต่อถูกตัด';
      broadcastLiveStatus();
    }
  });
}

/* ── External chat endpoint (from bookmarklet running in browser on tiktok.com) ── */
app.post('/api/external-chat', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { uniqueId, nickname, profilePicUrl } = req.body;
  if (!uniqueId) return res.status(400).json({ error: 'uniqueId required' });

  const uid = String(uniqueId).trim().replace('@', '');
  if (!uid) return res.status(400).json({ error: 'invalid uniqueId' });

  const existing = commenters.get(uid);
  commenters.set(uid, {
    uniqueId: uid,
    nickname: nickname || existing?.nickname || uid,
    profilePicUrl: (() => {
      const raw = profilePicUrl || existing?.profilePicUrl || '';
      if (!raw) return `/api/img?url=${encodeURIComponent(`https://unavatar.io/tiktok/${uid}`)}`;
      if (raw.includes('tiktokcdn') || raw.includes('muscdn')) return `/api/img?url=${encodeURIComponent(raw)}`;
      return raw;
    })(),
    lastSeen: Date.now(),
    msgCount: (existing?.msgCount || 0) + 1,
    lastMsg: existing?.lastMsg || '',
    source: 'bookmarklet',
  });

  const entry = commenters.get(uid);
  io.emit('chatCapture', {
    uniqueId: entry.uniqueId,
    displayName: entry.nickname,
    profilePicUrl: entry.profilePicUrl,
  });
  broadcastCommenters();
  res.json({ ok: true, count: commenters.size });
});

/* preflight for bookmarklet CORS */
app.options('/api/external-chat', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.sendStatus(204);
});

/* ── Serve bookmarklet.js from public/ with correct Content-Type ── */
const path = require('path');
app.get('/bookmarklet.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'no-cache');
  res.set('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../public/bookmarklet.js'));
});

/* ── Live API ── */
app.post('/api/live/connect', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'ต้องระบุ username' });
  connectLive(username.replace('@', '').trim());
  res.json({ ok: true });
});

app.post('/api/live/disconnect', (req, res) => {
  disconnectLive();
  commenters.clear();
  broadcastCommenters();
  res.json({ ok: true });
});

app.get('/api/live/status', (req, res) => {
  res.json({ status: liveStatus, host: liveHost, error: liveError, commenterCount: commenters.size });
});

app.get('/api/live/commenters', (req, res) => {
  const list = Array.from(commenters.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_COMMENTERS);
  res.json(list);
});

/* ── Player API ── */
app.get('/api/tiktok-info/:username', async (req, res) => {
  const username = req.params.username.replace('@', '').trim();
  if (!username) return res.status(400).json({ error: 'username required' });

  // Check live commenters first (has real nickname!)
  if (commenters.has(username)) {
    const c = commenters.get(username);
    return res.json({ username, displayName: c.nickname, profilePicUrl: c.profilePicUrl });
  }

  const profilePicUrl = `/api/img?url=${encodeURIComponent(`https://unavatar.io/tiktok/${username}`)}`;
  let displayName = username;
  try {
    const oEmbed = await axios.get(
      `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`,
      { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (oEmbed.data?.author_name) displayName = oEmbed.data.author_name;
  } catch (_) {}

  res.json({ username, displayName, profilePicUrl });
});

app.get('/api/players', (req, res) => {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  res.json(sorted);
});

app.post('/api/player', (req, res) => {
  const { username, displayName, profilePicUrl } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const id = username.trim().replace('@', '');
  if (players.has(id)) return res.status(409).json({ error: 'มีผู้เล่นนี้อยู่แล้ว' });
  // Proxy the pic if it's a TikTok CDN URL
  const pic = profilePicUrl && (profilePicUrl.includes('tiktokcdn') || profilePicUrl.includes('muscdn'))
    ? `/api/img?url=${encodeURIComponent(profilePicUrl)}`
    : (profilePicUrl || `/api/img?url=${encodeURIComponent(`https://unavatar.io/tiktok/${id}`)}`);
  players.set(id, { id, username: id, displayName: displayName || id, profilePicUrl: pic, win: 0, joinedAt: Date.now() });
  broadcast();
  res.json(players.get(id));
});

app.delete('/api/player/:id', (req, res) => {
  const { id } = req.params;
  if (!players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  players.delete(id);
  broadcast();
  res.json({ ok: true });
});

app.patch('/api/player/:id/win', (req, res) => {
  const { id } = req.params;
  const { delta } = req.body;
  if (!players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  const p = players.get(id);
  p.win = Math.max(0, p.win + (delta || 0));
  broadcast();
  res.json(p);
});

app.post('/api/reset', (req, res) => {
  players.clear();
  broadcast();
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  socket.emit('players', sorted);
  socket.emit('liveStatus', { status: liveStatus, host: liveHost, error: liveError, commenterCount: commenters.size });
  socket.emit('commenters', Array.from(commenters.values()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_COMMENTERS));
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
