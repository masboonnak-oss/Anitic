const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/* ── Cache folder ── */
const CACHE_DIR = path.join(__dirname, '../cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const AVATAR_DIR = path.join(__dirname, '../cache/avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

/* Download avatar image and save to disk; returns stable local URL */
async function downloadAvatar(username, remoteUrl) {
  const filePath = path.join(AVATAR_DIR, `${username}.jpg`);
  try {
    const response = await axios.get(remoteUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.tiktok.com/',
      },
      maxRedirects: 5,
    });
    fs.writeFileSync(filePath, response.data);
    console.log(`[avatar] saved @${username} (${Math.round(response.data.byteLength / 1024)}KB)`);
    return `/api/avatar/${encodeURIComponent(username)}`;
  } catch (e) {
    console.warn(`[avatar] download failed for @${username}:`, e.message);
    return null;
  }
}

/* Fetch real TikTok user info from tikwm.com, download avatar, return {displayName, profilePicUrl} */
async function fetchTikwmUser(username) {
  try {
    const tikwm = await axios.get(
      `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`,
      { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const user = tikwm.data?.data?.user;
    if (!user) return null;
    const displayName = user.nickname || username;
    const avatarUrl = user.avatarLarger || user.avatarMedium || user.avatarThumb;
    let profilePicUrl = uiAvatar(username);
    if (avatarUrl) {
      const local = await downloadAvatar(username, avatarUrl);
      if (local) profilePicUrl = local;
    }
    console.log(`[tikwm] @${username} → "${displayName}" pic=${profilePicUrl}`);
    return { displayName, profilePicUrl };
  } catch (e) {
    console.warn(`[tikwm] failed for @${username}:`, e.message);
    return null;
  }
}

function saveToCache(uniqueId, data) {
  try {
    const file = path.join(CACHE_DIR, `${uniqueId}.json`);
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    fs.writeFileSync(file, JSON.stringify({ ...existing, ...data, updatedAt: Date.now() }, null, 2));
  } catch (_) {}
}

function loadFromCache(uniqueId) {
  try {
    const file = path.join(CACHE_DIR, `${uniqueId}.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return null;
}

function loadAllCache() {
  try {
    return fs.readdirSync(CACHE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8')); }
        catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) { return []; }
}

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

/* ── Players persistence ── */
const PLAYERS_FILE = path.join(CACHE_DIR, '_players.json');

function savePlayers() {
  try {
    const list = Array.from(players.values());
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    console.error('[persist] save failed:', e.message);
  }
}

function loadPlayers() {
  try {
    if (!fs.existsSync(PLAYERS_FILE)) return;
    const list = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    list.forEach(p => {
      if (p?.id) players.set(p.id, p);
    });
    console.log(`[persist] loaded ${players.size} players from backup`);
  } catch (e) {
    console.error('[persist] load failed:', e.message);
  }
}

/* ── In-memory state ── */
const players = new Map();
let currentKingId = null;   // track who holds rank #1

loadPlayers();

// Silently init king from backup (no celebration on server start)
(function initKing() {
  const sorted = Array.from(players.values()).sort((a, b) => b.win - a.win);
  if (sorted.length > 0) currentKingId = sorted[0].id;
})();

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

  // Detect new king
  const top = sorted[0];
  if (top && top.id !== currentKingId) {
    if (currentKingId !== null) {
      // A different player just took rank #1 — celebrate!
      io.emit('newKing', top);
      console.log(`[newKing] 👑 ${top.displayName || top.username} (${top.win} wins)`);
    }
    currentKingId = top.id;
  }
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
function uiAvatar(username) {
  const initials = encodeURIComponent((username || '?').slice(0, 2).toUpperCase());
  return `https://ui-avatars.com/api/?name=${initials}&background=1a1a2e&color=ffd700&bold=true&size=128`;
}

function proxiedPic(url, username) {
  if (!url) return uiAvatar(username);
  // Wrap TikTok CDN URLs through our proxy
  if (url.includes('tiktokcdn') || url.includes('tiktok.com') || url.includes('muscdn')) {
    return `/api/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/* ── TikTok Live connection ── */
let retryTimer = null;
let retryAttempt = 0;
const MAX_RETRIES = 6;

function classifyError(msg) {
  if (msg.includes('UserOffline') || msg.includes('not live') || msg.includes('OFFLINE'))
    return { code: 'OFFLINE', th: 'ผู้ใช้ไม่ได้ไลฟ์อยู่' };
  if (msg.includes('Room ID') || msg.includes('sources'))
    return { code: 'ROOM_NOT_FOUND', th: 'หา Room ID ไม่เจอ — อาจไม่ได้ไลฟ์ หรือ IP ถูกบล็อค' };
  if (msg.includes('Access Denied') || msg.includes('403') || msg.includes('Forbidden'))
    return { code: 'IP_BANNED', th: 'IP ถูกบล็อค (Access Denied 403)' };
  if (msg.includes('Session') || msg.includes('Unauthorized') || msg.includes('401') || msg.includes('sessionid'))
    return { code: 'SESSION_EXPIRED', th: 'Session หมดอายุ — กรุณาอัปเดต TIKTOK_SESSION_ID ใหม่' };
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED'))
    return { code: 'NETWORK', th: 'Network timeout / เชื่อมต่อไม่ได้' };
  if (msg.includes('Sign') || msg.includes('signature') || msg.includes('eulerstream'))
    return { code: 'SIGN_FAIL', th: 'Euler sign server ตอบสนองไม่ได้' };
  return { code: 'UNKNOWN', th: msg.slice(0, 120) };
}

function disconnectLive() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  retryAttempt = 0;
  if (liveConnection) {
    try { liveConnection.disconnect(); } catch (_) {}
    liveConnection = null;
  }
  liveStatus = 'disconnected';
  liveHost = null;
  liveError = null;
  broadcastLiveStatus();
}

function connectLive(username, attempt) {
  if (attempt === undefined) {
    // Fresh connect — reset retries
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    retryAttempt = 0;
    if (liveConnection) {
      try { liveConnection.disconnect(); } catch (_) {}
      liveConnection = null;
    }
    liveHost = username;
  }

  if (!TikTokLiveConnection) {
    liveStatus = 'error';
    liveError = 'tiktok-live-connector ไม่พร้อมใช้งาน';
    broadcastLiveStatus();
    return;
  }

  liveStatus = 'connecting';
  liveError = attempt > 0 ? `กำลัง retry ครั้งที่ ${attempt}/${MAX_RETRIES}...` : null;
  broadcastLiveStatus();

  const sessionId = process.env.TIKTOK_SESSION_ID;

  const connOptions = {
    processInitialData: true,
    fetchRoomInfoOnConnect: true,
    enableExtendedGiftInfo: false,
    ...(sessionId ? {
      session: { cookie: { sessionId } },
      authenticateWs: true,
    } : {}),
  };

  console.log(`[TikTok] Connecting to @${username}` +
    (attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '') +
    (sessionId ? ' [Session Cookie ✓]' : ' [No Session — anonymous]'));

  let conn;
  try {
    conn = new TikTokLiveConnection(username, connOptions);
  } catch (e) {
    console.error('[TikTok] Failed to create connection:', e.message);
    liveStatus = 'error';
    liveError = e.message || 'สร้าง connection ไม่ได้';
    liveConnection = null;
    broadcastLiveStatus();
    return;
  }

  liveConnection = conn;

  conn.connect()
    .then(() => {
      console.log(`[TikTok] ✅ Connected to @${username}`);
      retryAttempt = 0;
      liveStatus = 'connected';
      liveError = null;
      broadcastLiveStatus();
    })
    .catch((err) => {
      const msg = err?.message || String(err);
      const { code, th } = classifyError(msg);
      console.error(`[TikTok] ❌ Connect failed [${code}]: ${msg}`);
      liveConnection = null;

      // Non-retryable errors
      const noRetry = code === 'OFFLINE' || code === 'SESSION_EXPIRED';
      const canRetry = !noRetry && retryAttempt < MAX_RETRIES;

      if (canRetry) {
        retryAttempt++;
        const delay = Math.min(2000 * Math.pow(2, retryAttempt - 1), 60000); // 2s, 4s, 8s … 60s
        console.log(`[TikTok] Retry ${retryAttempt}/${MAX_RETRIES} in ${delay / 1000}s...`);
        liveStatus = 'connecting';
        liveError = `[${code}] ${th} — retry ${retryAttempt}/${MAX_RETRIES} ใน ${delay / 1000}s`;
        broadcastLiveStatus();
        retryTimer = setTimeout(() => connectLive(username, retryAttempt), delay);
      } else {
        liveStatus = 'error';
        liveError = `[${code}] ${th}`;
        broadcastLiveStatus();
      }
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
    const displayName = nickname || uid;
    commenters.set(uid, {
      uniqueId: uid,
      nickname: displayName,
      profilePicUrl: picUrl,
      lastSeen: Date.now(),
      msgCount: (commenters.get(uid)?.msgCount || 0) + 1,
      lastMsg: data?.comment || '',
    });

    saveToCache(uid, { uniqueId: uid, displayName, profilePicUrl: picUrl });

    io.emit('chatCapture', { uniqueId: uid, displayName, profilePicUrl: picUrl });

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

  // 1. Live commenters (most fresh data)
  if (commenters.has(username)) {
    const c = commenters.get(username);
    return res.json({ username, displayName: c.nickname, profilePicUrl: c.profilePicUrl });
  }

  // 2. Cache folder — only use if avatar is already downloaded locally
  const cached = loadFromCache(username);
  if (cached?.displayName && cached?.profilePicUrl?.startsWith('/api/avatar/')) {
    return res.json({ username, displayName: cached.displayName, profilePicUrl: cached.profilePicUrl });
  }

  // 3. Fetch from tikwm.com — downloads avatar locally so URL never expires
  const info = await fetchTikwmUser(username);
  const displayName = info?.displayName || username;
  const profilePicUrl = info?.profilePicUrl || uiAvatar(username);

  if (!info) {
    // Fallback: TikTok oEmbed for display name only
    try {
      const oEmbed = await axios.get(
        `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`,
        { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (oEmbed.data?.author_name) {
        saveToCache(username, { uniqueId: username, displayName: oEmbed.data.author_name, profilePicUrl });
        return res.json({ username, displayName: oEmbed.data.author_name, profilePicUrl });
      }
    } catch (_) {}
  }

  saveToCache(username, { uniqueId: username, displayName, profilePicUrl });
  res.json({ username, displayName, profilePicUrl });
});

/* ── Serve locally-cached avatar images ── */
app.get('/api/avatar/:username', (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const filePath = path.join(AVATAR_DIR, `${username}.jpg`);
  if (!fs.existsSync(filePath)) return res.status(404).send('no avatar');
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

/* ── Cache API ── */
app.get('/api/cache', (req, res) => {
  res.json(loadAllCache());
});

app.get('/api/cache/:username', (req, res) => {
  const data = loadFromCache(req.params.username);
  if (!data) return res.status(404).json({ error: 'not in cache' });
  res.json(data);
});

app.get('/api/players', (req, res) => {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  res.json(sorted);
});

app.post('/api/player', async (req, res) => {
  const { username, displayName, profilePicUrl } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const id = username.trim().replace('@', '');
  if (players.has(id)) return res.status(409).json({ error: 'มีผู้เล่นนี้อยู่แล้ว' });

  let pic = profilePicUrl || '';
  let name = displayName || id;

  const needsFetch = !pic || pic.includes('ui-avatars.com') || pic.includes('unavatar');

  if (needsFetch) {
    // Try cache first (only if avatar is already downloaded locally)
    const cached = loadFromCache(id);
    const cachedHasRealPic = cached?.profilePicUrl?.startsWith('/api/avatar/');
    if (cachedHasRealPic) {
      pic = cached.profilePicUrl;
      if (!displayName || displayName === id) name = cached.displayName || id;
    } else {
      // Fetch fresh from tikwm — downloads avatar to disk
      const info = await fetchTikwmUser(id);
      if (info) {
        pic = info.profilePicUrl;
        if (!displayName || displayName === id) name = info.displayName;
        saveToCache(id, { uniqueId: id, displayName: name, profilePicUrl: pic });
      }
    }
  }

  if (!pic) pic = uiAvatar(id);

  players.set(id, { id, username: id, displayName: name, profilePicUrl: pic, win: 0, joinedAt: Date.now() });
  savePlayers();
  broadcast();
  res.json(players.get(id));
});

app.delete('/api/player/:id', (req, res) => {
  const { id } = req.params;
  if (!players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  players.delete(id);
  savePlayers();
  broadcast();
  res.json({ ok: true });
});

app.patch('/api/player/:id/win', (req, res) => {
  const { id } = req.params;
  const { delta } = req.body;
  if (!players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  const p = players.get(id);
  p.win = Math.max(0, p.win + (delta || 0));
  savePlayers();
  broadcast();
  res.json(p);
});

app.post('/api/reset', (req, res) => {
  players.clear();
  savePlayers();
  broadcast();
  res.json({ ok: true });
});

// threshold ของ Top1 — { id, win } หรือ null — เก็บไว้ server side ให้ OBS reload ก็รอด
let top1Threshold = null;

app.post('/api/reset-top1', (req, res) => {
  const sorted = Array.from(players.values()).sort((a, b) => b.win - a.win);
  const top = sorted[0];
  top1Threshold = top ? { id: top.id, win: top.win } : null;
  io.emit('top1Reset', top1Threshold);
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  socket.emit('players', sorted);
  socket.emit('liveStatus', { status: liveStatus, host: liveHost, error: liveError, commenterCount: commenters.size });
  socket.emit('commenters', Array.from(commenters.values()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_COMMENTERS));
  // ส่ง threshold ปัจจุบันให้ทุก client ที่ connect ใหม่ (รวม OBS reload)
  socket.emit('top1Threshold', top1Threshold);
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
