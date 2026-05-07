const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/* ── In-memory state ── */
const players = new Map();

// Live capture state
let liveConnection = null;
let liveHost = null;
let liveStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
let liveError = null;

// Recent commenters seen in the live (uniqueId → commenter info)
const commenters = new Map();
const MAX_COMMENTERS = 50;

function broadcast() {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  io.emit('players', sorted);
}

function broadcastLiveStatus() {
  io.emit('liveStatus', {
    status: liveStatus,
    host: liveHost,
    error: liveError,
    commenterCount: commenters.size,
  });
}

function broadcastCommenters() {
  const list = Array.from(commenters.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_COMMENTERS);
  io.emit('commenters', list);
}

/* ── TikTok Live ── */
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
  liveHost = username;
  liveStatus = 'connecting';
  liveError = null;
  broadcastLiveStatus();

  const conn = new WebcastPushConnection(username, {
    processInitialData: false,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    sessionId: undefined,
  });
  liveConnection = conn;

  conn.connect()
    .then(() => {
      liveStatus = 'connected';
      liveError = null;
      broadcastLiveStatus();
    })
    .catch((err) => {
      liveStatus = 'error';
      liveError = err.message || 'ไม่สามารถเชื่อมต่อได้';
      liveConnection = null;
      broadcastLiveStatus();
    });

  conn.on('chat', (data) => {
    const uid = data.uniqueId;
    if (!uid) return;
    commenters.set(uid, {
      uniqueId: uid,
      nickname: data.nickname || uid,
      profilePicUrl: data.profilePictureUrl || `https://unavatar.io/tiktok/${uid}`,
      lastSeen: Date.now(),
      msgCount: (commenters.get(uid)?.msgCount || 0) + 1,
      lastMsg: data.comment || '',
    });
    // Trim if too big
    if (commenters.size > MAX_COMMENTERS * 2) {
      const sorted = [...commenters.entries()].sort((a,b) => b[1].lastSeen - a[1].lastSeen);
      commenters.clear();
      sorted.slice(0, MAX_COMMENTERS).forEach(([k,v]) => commenters.set(k, v));
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
  res.json({
    status: liveStatus,
    host: liveHost,
    error: liveError,
    commenterCount: commenters.size,
  });
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

  // Check if we have this person in live commenters (has real name!)
  if (commenters.has(username)) {
    const c = commenters.get(username);
    return res.json({ username, displayName: c.nickname, profilePicUrl: c.profilePicUrl });
  }

  const profilePicUrl = `https://unavatar.io/tiktok/${username}`;
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
  players.set(id, {
    id, username: id,
    displayName: displayName || id,
    profilePicUrl: profilePicUrl || `https://unavatar.io/tiktok/${id}`,
    win: 0, joinedAt: Date.now()
  });
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
  const commenterList = Array.from(commenters.values()).sort((a,b)=>b.lastSeen-a.lastSeen).slice(0,MAX_COMMENTERS);
  socket.emit('commenters', commenterList);
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
