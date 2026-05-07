const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const players = new Map();

function broadcast() {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.win - a.win)
    .map((p, i) => ({ ...p, rank: i + 1 }));
  io.emit('players', sorted);
}

// Fetch TikTok profile pic and try to get display name
app.get('/api/tiktok-info/:username', async (req, res) => {
  const username = req.params.username.replace('@', '').trim();
  if (!username) return res.status(400).json({ error: 'username required' });

  const profilePicUrl = `https://unavatar.io/tiktok/${username}`;

  // Try TikTok oEmbed API to get real display name
  let displayName = username;
  try {
    const oEmbed = await axios.get(
      `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`,
      { timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (oEmbed.data && oEmbed.data.author_name) {
      displayName = oEmbed.data.author_name;
    }
  } catch (e) {
    // fallback: try scraping nickname from profile page
    try {
      const r = await axios.get(`https://www.tiktok.com/@${username}`, {
        timeout: 6000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      const nickMatch = r.data.match(/"nickname":"([^"]+)"/);
      if (nickMatch) displayName = nickMatch[1];
    } catch (_) { /* use username as fallback */ }
  }

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
    id,
    username: id,
    displayName: displayName || id,
    profilePicUrl: profilePicUrl || `https://unavatar.io/tiktok/${id}`,
    win: 0,
    joinedAt: Date.now()
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
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
