const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let tiktokConn = null;
let isConnected = false;
let currentUsername = null;

const players = new Map();

function getOrCreatePlayer(uniqueId, nickname, profilePictureUrl) {
  if (!players.has(uniqueId)) {
    players.set(uniqueId, {
      uniqueId,
      nickname: nickname || uniqueId,
      profilePictureUrl: profilePictureUrl || '',
      likeCount: 0,
      commentCount: 0,
      score: 0,
      village: '',
      winRate: '',
      joinedAt: Date.now()
    });
  } else {
    const p = players.get(uniqueId);
    if (nickname) p.nickname = nickname;
    if (profilePictureUrl) p.profilePictureUrl = profilePictureUrl;
  }
  return players.get(uniqueId);
}

function broadcastLeaderboard() {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  io.emit('leaderboard', sorted);
}

function connectToTikTok(username) {
  if (tiktokConn) {
    try { tiktokConn.disconnect(); } catch (e) {}
    tiktokConn = null;
  }
  isConnected = false;
  currentUsername = username;

  tiktokConn = new WebcastPushConnection(username);

  tiktokConn.connect().then(() => {
    isConnected = true;
    console.log(`Connected to TikTok Live: @${username}`);
    io.emit('status', { connected: true, username });
  }).catch(err => {
    isConnected = false;
    console.error('Connection error:', err.message);
    io.emit('status', { connected: false, username, error: err.message });
  });

  tiktokConn.on('like', data => {
    const player = getOrCreatePlayer(data.uniqueId, data.nickname, data.profilePictureUrl);
    player.likeCount += data.likeCount || 1;
    player.score = player.likeCount * 1 + player.commentCount * 2;
    broadcastLeaderboard();
  });

  tiktokConn.on('chat', data => {
    const player = getOrCreatePlayer(data.uniqueId, data.nickname, data.profilePictureUrl);
    player.commentCount += 1;
    player.score = player.likeCount * 1 + player.commentCount * 2;
    broadcastLeaderboard();
  });

  tiktokConn.on('gift', data => {
    const player = getOrCreatePlayer(data.uniqueId, data.nickname, data.profilePictureUrl);
    player.score += (data.diamondCount || 0) * 5;
    broadcastLeaderboard();
  });

  tiktokConn.on('disconnect', () => {
    isConnected = false;
    io.emit('status', { connected: false, username });
  });
}

app.post('/api/connect', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  connectToTikTok(username.replace('@', ''));
  res.json({ ok: true, message: `Connecting to @${username}...` });
});

app.post('/api/disconnect', (req, res) => {
  if (tiktokConn) {
    try { tiktokConn.disconnect(); } catch (e) {}
    tiktokConn = null;
  }
  isConnected = false;
  io.emit('status', { connected: false, username: currentUsername });
  res.json({ ok: true });
});

app.post('/api/reset', (req, res) => {
  players.clear();
  broadcastLeaderboard();
  res.json({ ok: true });
});

app.get('/api/players', (req, res) => {
  const sorted = Array.from(players.values()).sort((a, b) => b.score - a.score);
  res.json(sorted);
});

app.put('/api/player/:uniqueId', (req, res) => {
  const { uniqueId } = req.params;
  const { village, winRate, nickname } = req.body;
  if (!players.has(uniqueId)) return res.status(404).json({ error: 'Player not found' });
  const player = players.get(uniqueId);
  if (village !== undefined) player.village = village;
  if (winRate !== undefined) player.winRate = winRate;
  if (nickname !== undefined) player.nickname = nickname;
  broadcastLeaderboard();
  res.json(player);
});

app.post('/api/player', (req, res) => {
  const { uniqueId, nickname, village, winRate, profilePictureUrl } = req.body;
  if (!uniqueId) return res.status(400).json({ error: 'uniqueId required' });
  const player = getOrCreatePlayer(uniqueId, nickname, profilePictureUrl);
  if (village !== undefined) player.village = village;
  if (winRate !== undefined) player.winRate = winRate;
  broadcastLeaderboard();
  res.json(player);
});

app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected, username: currentUsername });
});

io.on('connection', (socket) => {
  socket.emit('status', { connected: isConnected, username: currentUsername });
  broadcastLeaderboard();
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
