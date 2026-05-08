const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/* ── Dirs ── */
const CACHE_DIR  = path.join(__dirname, '../cache');
const AVATAR_DIR = path.join(__dirname, '../cache/avatars');
const USERS_DIR  = path.join(__dirname, '../cache/users');
[CACHE_DIR, AVATAR_DIR, USERS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

/* ── JWT secret (persisted in _auth.json) ── */
const AUTH_FILE = path.join(CACHE_DIR, '_auth.json');
function loadAuthMeta() {
  try { if (fs.existsSync(AUTH_FILE)) return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')); } catch (_) {}
  return {};
}
function saveAuthMeta(d) { fs.writeFileSync(AUTH_FILE, JSON.stringify(d, null, 2)); }
let _meta = loadAuthMeta();
if (!_meta.secret) { _meta.secret = crypto.randomBytes(32).toString('hex'); saveAuthMeta(_meta); }
const JWT_SECRET = _meta.secret;

/* ── Multi-user store (_users.json) ── */
const USERS_FILE = path.join(CACHE_DIR, '_users.json');
function loadUsers() {
  try { if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch (_) {}
  return [];
}
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
function findUser(username) { return loadUsers().find(u => u.username === username); }

/* Migrate single-admin _auth.json → _users.json */
(function migrate() {
  const meta = loadAuthMeta();
  if (meta.username && meta.passwordHash) {
    const users = loadUsers();
    if (!users.find(u => u.username === meta.username)) {
      users.push({ username: meta.username, passwordHash: meta.passwordHash });
      saveUsers(users);
      console.log(`[auth] migrated user: ${meta.username}`);
    }
    const userDir = path.join(USERS_DIR, meta.username);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    const oldPlayers = path.join(CACHE_DIR, '_players.json');
    const newPlayers = path.join(userDir, '_players.json');
    if (fs.existsSync(oldPlayers) && !fs.existsSync(newPlayers)) {
      fs.copyFileSync(oldPlayers, newPlayers);
      console.log(`[auth] migrated players for ${meta.username}`);
    }
    delete meta.username; delete meta.passwordHash;
    saveAuthMeta(meta);
  }
})();

/* ── Auth middleware ── */
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาล็อคอินก่อน' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch (_) { res.status(401).json({ error: 'Token หมดอายุ กรุณาล็อคอินใหม่' }); }
}

/* ── Helpers ── */
function safeFilename(u) { return u.replace(/[^a-zA-Z0-9_-]/g, '_'); }

function uiAvatar(username) {
  const i = encodeURIComponent((username || '?').slice(0, 2).toUpperCase());
  return `https://ui-avatars.com/api/?name=${i}&background=1a1a2e&color=ffd700&bold=true&size=128`;
}
function proxiedPic(url, username) {
  if (!url) return uiAvatar(username);
  if (url.includes('tiktokcdn') || url.includes('tiktok.com') || url.includes('muscdn'))
    return `/api/img?url=${encodeURIComponent(url)}`;
  return url;
}

/* ── Avatar download ── */
async function downloadAvatar(username, remoteUrl) {
  const filePath = path.join(AVATAR_DIR, `${safeFilename(username)}.jpg`);
  try {
    const response = await axios.get(remoteUrl, {
      responseType: 'arraybuffer', timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15', 'Referer': 'https://www.tiktok.com/' },
      maxRedirects: 5,
    });
    fs.writeFileSync(filePath, response.data);
    console.log(`[avatar] saved @${username} (${Math.round(response.data.byteLength / 1024)}KB)`);
    return `/api/avatar/${encodeURIComponent(username)}`;
  } catch (e) { console.warn(`[avatar] download failed for @${username}:`, e.message); return null; }
}

/* ── TikTok page scraper ── */
async function fetchFromTikTokPage(username) {
  try {
    const sessionId = process.env.TIKTOK_SESSION_ID || '';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    if (sessionId) headers['Cookie'] = `sessionid=${sessionId}`;
    const resp = await axios.get(`https://www.tiktok.com/@${encodeURIComponent(username)}`, { timeout: 12000, headers, maxRedirects: 5 });
    const html = resp.data;
    const imgMatch   = html.match(/<meta[^>]+property="og:image"\s+content="([^"]+)"/i) || html.match(/<meta[^>]+content="([^"]+)"\s+property="og:image"/i);
    const titleMatch = html.match(/<meta[^>]+property="og:title"\s+content="([^"]+)"/i) || html.match(/<meta[^>]+content="([^"]+)"\s+property="og:title"/i);
    if (!imgMatch) return null;
    const avatarUrl   = imgMatch[1].replace(/&amp;/g, '&');
    const displayName = titleMatch ? titleMatch[1].replace(/\s*[\|–-]\s*TikTok.*$/i,'').replace(/\s*\(@[^)]+\).*$/,'').replace(/&amp;/g,'&').trim() || null : null;
    console.log(`[tiktok-page] @${username} → "${displayName}" avatar found`);
    return { avatarUrl, displayName };
  } catch (e) { console.warn(`[tiktok-page] failed for @${username}:`, e.message); return null; }
}

async function fetchTikwmUser(username) {
  const queryId = /^\d+$/.test(username) ? `user${username}` : username;
  try {
    const tikwm = await axios.get(`https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(queryId)}`, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const user = tikwm.data?.data?.user;
    if (user) {
      const displayName = user.nickname || username;
      const avatarUrl   = user.avatarLarger || user.avatarMedium || user.avatarThumb;
      let profilePicUrl = uiAvatar(username);
      if (avatarUrl) { const local = await downloadAvatar(username, avatarUrl); if (local) profilePicUrl = local; }
      console.log(`[tikwm] @${username} → "${displayName}" pic=${profilePicUrl}`);
      return { displayName, profilePicUrl };
    }
  } catch (e) { console.warn(`[tikwm] failed for @${username}:`, e.message); }

  const pageData = await fetchFromTikTokPage(username);
  if (pageData?.avatarUrl) {
    const local = await downloadAvatar(username, pageData.avatarUrl);
    return { displayName: pageData.displayName || username, profilePicUrl: local || uiAvatar(username) };
  }
  if (/^\d+$/.test(username)) {
    const pd2 = await fetchFromTikTokPage(`user${username}`);
    if (pd2?.avatarUrl) {
      const local = await downloadAvatar(username, pd2.avatarUrl);
      return { displayName: pd2.displayName || username, profilePicUrl: local || uiAvatar(username) };
    }
  }
  return null;
}

function saveToCache(uniqueId, data) {
  try {
    const file = path.join(CACHE_DIR, `${uniqueId}.json`);
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    fs.writeFileSync(file, JSON.stringify({ ...existing, ...data, updatedAt: Date.now() }, null, 2));
  } catch (_) {}
}
function loadFromCache(uniqueId) {
  try { const file = path.join(CACHE_DIR, `${uniqueId}.json`); if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return null;
}

/* ── Per-user state ── */
const userStates = new Map();
const MAX_COMMENTERS = 60;

function getUserPlayerFile(username) {
  const dir = path.join(USERS_DIR, username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, '_players.json');
}

function saveUserPlayers(username, players) {
  try { fs.writeFileSync(getUserPlayerFile(username), JSON.stringify(Array.from(players.values()), null, 2)); }
  catch (e) { console.error(`[persist:${username}] save failed:`, e.message); }
}

function loadUserPlayers(username) {
  const players = new Map();
  try {
    const file = getUserPlayerFile(username);
    if (fs.existsSync(file)) {
      const list = JSON.parse(fs.readFileSync(file, 'utf8'));
      list.forEach(p => { if (p?.id) players.set(p.id, p); });
      console.log(`[persist:${username}] loaded ${players.size} players`);
    }
  } catch (e) { console.error(`[persist:${username}] load failed:`, e.message); }
  return players;
}

function getUserState(username) {
  if (!userStates.has(username)) {
    const players = loadUserPlayers(username);
    const sorted  = Array.from(players.values()).sort((a, b) => b.win - a.win);
    userStates.set(username, {
      players,
      currentKingId:  sorted.length > 0 ? sorted[0].id : null,
      top1Threshold:  null,
      liveConnection: null,
      liveHost:       null,
      liveStatus:     'disconnected',
      liveError:      null,
      commenters:     new Map(),
      retryTimer:     null,
      retryAttempt:   0,
    });
  }
  return userStates.get(username);
}

/* ── Express + Socket.IO ── */
let TikTokLiveConnection, WebcastEvent;
try { const pkg = require('tiktok-live-connector'); TikTokLiveConnection = pkg.TikTokLiveConnection; WebcastEvent = pkg.WebcastEvent; }
catch (e) { console.log('tiktok-live-connector not available:', e.message); }

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json());

/* ── Broadcasts (per-user room) ── */
function broadcast(username) {
  const st = getUserState(username);
  const sorted = Array.from(st.players.values()).sort((a, b) => b.win - a.win).map((p, i) => ({ ...p, rank: i + 1 }));
  io.to(`room:${username}`).emit('players', sorted);
  const top = sorted[0];
  if (top && top.id !== st.currentKingId) {
    if (st.currentKingId !== null) { io.to(`room:${username}`).emit('newKing', top); console.log(`[newKing:${username}] 👑 ${top.displayName} (${top.win} wins)`); }
    st.currentKingId = top.id;
  }
}
function broadcastLiveStatus(username) {
  const st = getUserState(username);
  io.to(`room:${username}`).emit('liveStatus', { status: st.liveStatus, host: st.liveHost, error: st.liveError, commenterCount: st.commenters.size });
}
function broadcastCommenters(username) {
  const st = getUserState(username);
  io.to(`room:${username}`).emit('commenters', Array.from(st.commenters.values()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_COMMENTERS));
}

function sendInitialState(socket, username) {
  const st = getUserState(username);
  const sorted = Array.from(st.players.values()).sort((a, b) => b.win - a.win).map((p, i) => ({ ...p, rank: i + 1 }));
  socket.emit('players', sorted);
  socket.emit('liveStatus', { status: st.liveStatus, host: st.liveHost, error: st.liveError, commenterCount: st.commenters.size });
  socket.emit('commenters', Array.from(st.commenters.values()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_COMMENTERS));
  socket.emit('top1Threshold', st.top1Threshold);
}

/* ── TikTok Live (per-user) ── */
const MAX_RETRIES = 6;

function classifyError(msg) {
  if (msg.includes('UserOffline') || msg.includes('not live') || msg.includes('OFFLINE')) return { code: 'OFFLINE', th: 'ผู้ใช้ไม่ได้ไลฟ์อยู่' };
  if (msg.includes('Room ID') || msg.includes('sources')) return { code: 'ROOM_NOT_FOUND', th: 'หา Room ID ไม่เจอ — อาจไม่ได้ไลฟ์' };
  if (msg.includes('Access Denied') || msg.includes('403') || msg.includes('Forbidden')) return { code: 'IP_BANNED', th: 'IP ถูกบล็อค (Access Denied 403)' };
  if (msg.includes('Session') || msg.includes('Unauthorized') || msg.includes('401') || msg.includes('sessionid')) return { code: 'SESSION_EXPIRED', th: 'Session หมดอายุ' };
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) return { code: 'NETWORK', th: 'Network timeout' };
  if (msg.includes('Sign') || msg.includes('signature') || msg.includes('eulerstream')) return { code: 'SIGN_FAIL', th: 'Sign server ตอบสนองไม่ได้' };
  return { code: 'UNKNOWN', th: msg.slice(0, 120) };
}

function disconnectLive(adminUser) {
  const st = getUserState(adminUser);
  if (st.retryTimer) { clearTimeout(st.retryTimer); st.retryTimer = null; }
  st.retryAttempt = 0;
  if (st.liveConnection) { try { st.liveConnection.disconnect(); } catch (_) {} st.liveConnection = null; }
  st.liveStatus = 'disconnected'; st.liveHost = null; st.liveError = null;
  broadcastLiveStatus(adminUser);
}

function connectLive(adminUser, tiktokUser, attempt) {
  const st = getUserState(adminUser);
  if (attempt === undefined) {
    if (st.retryTimer) { clearTimeout(st.retryTimer); st.retryTimer = null; }
    st.retryAttempt = 0;
    if (st.liveConnection) { try { st.liveConnection.disconnect(); } catch (_) {} st.liveConnection = null; }
    st.liveHost = tiktokUser;
  }
  if (!TikTokLiveConnection) { st.liveStatus = 'error'; st.liveError = 'tiktok-live-connector ไม่พร้อมใช้งาน'; broadcastLiveStatus(adminUser); return; }

  st.liveStatus = 'connecting';
  st.liveError  = attempt > 0 ? `กำลัง retry ครั้งที่ ${attempt}/${MAX_RETRIES}...` : null;
  broadcastLiveStatus(adminUser);

  const sessionId = process.env.TIKTOK_SESSION_ID;
  const connOptions = {
    processInitialData: true, fetchRoomInfoOnConnect: true, enableExtendedGiftInfo: false,
    ...(sessionId ? { session: { cookie: { sessionId } }, authenticateWs: true } : {}),
  };
  console.log(`[TikTok:${adminUser}] Connecting to @${tiktokUser}` + (attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''));

  let conn;
  try { conn = new TikTokLiveConnection(tiktokUser, connOptions); }
  catch (e) { st.liveStatus = 'error'; st.liveError = e.message || 'สร้าง connection ไม่ได้'; st.liveConnection = null; broadcastLiveStatus(adminUser); return; }

  st.liveConnection = conn;

  conn.connect()
    .then(() => {
      console.log(`[TikTok:${adminUser}] ✅ Connected to @${tiktokUser}`);
      st.retryAttempt = 0; st.liveStatus = 'connected'; st.liveError = null;
      broadcastLiveStatus(adminUser);
    })
    .catch((err) => {
      const msg = err?.message || String(err);
      const { code, th } = classifyError(msg);
      console.error(`[TikTok:${adminUser}] ❌ [${code}]: ${msg}`);
      st.liveConnection = null;
      const noRetry  = code === 'OFFLINE' || code === 'SESSION_EXPIRED';
      const canRetry = !noRetry && st.retryAttempt < MAX_RETRIES;
      if (canRetry) {
        st.retryAttempt++;
        const delay = Math.min(2000 * Math.pow(2, st.retryAttempt - 1), 60000);
        st.liveStatus = 'connecting'; st.liveError = `[${code}] ${th} — retry ${st.retryAttempt}/${MAX_RETRIES} ใน ${delay/1000}s`;
        broadcastLiveStatus(adminUser);
        st.retryTimer = setTimeout(() => connectLive(adminUser, tiktokUser, st.retryAttempt), delay);
      } else {
        st.liveStatus = 'error'; st.liveError = `[${code}] ${th}`;
        broadcastLiveStatus(adminUser);
      }
    });

  const chatEvent = WebcastEvent?.CHAT || 'chat';
  conn.on(chatEvent, (data) => {
    const uid        = data?.user?.uniqueId || data?.uniqueId;
    const nickname   = data?.user?.nickname  || data?.nickname || uid;
    const picRaw     = data?.user?.profilePictureUrl || data?.user?.avatarUrl || data?.profilePictureUrl;
    if (!uid) return;
    const picUrl     = proxiedPic(picRaw, uid);
    const displayName = nickname || uid;
    st.commenters.set(uid, { uniqueId: uid, nickname: displayName, profilePicUrl: picUrl, lastSeen: Date.now(), msgCount: (st.commenters.get(uid)?.msgCount || 0) + 1, lastMsg: data?.comment || '' });
    saveToCache(uid, { uniqueId: uid, displayName, profilePicUrl: picUrl });
    io.to(`room:${adminUser}`).emit('chatCapture', { uniqueId: uid, displayName, profilePicUrl: picUrl });
    if (st.commenters.size > MAX_COMMENTERS * 2) {
      const entries = [...st.commenters.entries()].sort((a, b) => b[1].lastSeen - a[1].lastSeen);
      st.commenters.clear(); entries.slice(0, MAX_COMMENTERS).forEach(([k, v]) => st.commenters.set(k, v));
    }
    broadcastCommenters(adminUser);
  });

  conn.on('disconnected', () => {
    if (st.liveStatus === 'connected') { st.liveStatus = 'error'; st.liveError = 'การเชื่อมต่อถูกตัด'; broadcastLiveStatus(adminUser); }
  });
}

/* ── Socket.IO ── */
io.on('connection', (socket) => {
  /* Admin panel: authenticate with JWT → join user room */
  socket.on('authenticate', ({ token }) => {
    try {
      const admin = jwt.verify(token, JWT_SECRET);
      socket.username = admin.username;
      socket.join(`room:${admin.username}`);
      sendInitialState(socket, admin.username);
    } catch (_) { socket.emit('authError', { error: 'invalid token' }); }
  });

  /* Overlays: join room by username (public read-only) */
  socket.on('joinRoom', ({ username }) => {
    if (!username) return;
    socket.join(`room:${username}`);
    sendInitialState(socket, username);
  });
});

/* ── Auth routes ── */
app.post('/api/auth/register', async (req, res) => {
  const u = (req.body.username || '').trim();
  const p = (req.body.password || '');
  if (!u || u.length < 3) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' });
  if (p.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  const users = loadUsers();
  if (users.find(x => x.username === u)) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  const hash = await bcrypt.hash(p, 12);
  users.push({ username: u, passwordHash: hash });
  saveUsers(users);
  const token = jwt.sign({ username: u }, JWT_SECRET, { expiresIn: '30d' });
  console.log(`[auth] registered: ${u}`);
  res.json({ ok: true, token, username: u, role: 'user' });
});

app.post('/api/auth/login', async (req, res) => {
  const u    = (req.body.username || '').trim();
  const user = findUser(u);
  if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  const ok = await bcrypt.compare(req.body.password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  const token = jwt.sign({ username: u }, JWT_SECRET, { expiresIn: '30d' });
  console.log(`[auth] login: ${u}`);
  res.json({ ok: true, token, username: u, role: user.role || 'user' });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = findUser(req.admin.username);
  res.json({ ok: true, username: req.admin.username, role: user?.role || 'user' });
});

/* ── Super-admin middleware ── */
function superAdminMiddleware(req, res, next) {
  const user = findUser(req.admin.username);
  if (user?.role !== 'superadmin') return res.status(403).json({ error: 'เฉพาะ Super Admin เท่านั้น' });
  next();
}

/* ── Super Admin: list all users ── */
app.get('/api/admin/users', authMiddleware, superAdminMiddleware, (req, res) => {
  const users = loadUsers().map(u => {
    const st = userStates.get(u.username);
    const playerCount = st ? st.players.size : (() => {
      try {
        const file = path.join(USERS_DIR, u.username, '_players.json');
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).length;
      } catch (_) {}
      return 0;
    })();
    return { username: u.username, role: u.role || 'user', playerCount };
  });
  res.json(users);
});

/* ── Super Admin: delete a user ── */
app.delete('/api/admin/users/:username', authMiddleware, superAdminMiddleware, (req, res) => {
  const target = req.params.username;
  if (target === req.admin.username) return res.status(400).json({ error: 'ไม่สามารถลบตัวเองได้' });
  const users = loadUsers();
  const idx   = users.findIndex(u => u.username === target);
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

  /* Disconnect live if running */
  if (userStates.has(target)) {
    const st = userStates.get(target);
    if (st.retryTimer) clearTimeout(st.retryTimer);
    if (st.liveConnection) { try { st.liveConnection.disconnect(); } catch (_) {} }
    userStates.delete(target);
  }

  /* Remove user files */
  try {
    const userDir = path.join(USERS_DIR, target);
    if (fs.existsSync(userDir)) fs.rmSync(userDir, { recursive: true, force: true });
  } catch (_) {}

  users.splice(idx, 1);
  saveUsers(users);
  console.log(`[superadmin] deleted user: ${target}`);
  res.json({ ok: true });
});

/* ── Super Admin: reset password ── */
app.post('/api/admin/users/:username/reset-password', authMiddleware, superAdminMiddleware, async (req, res) => {
  const target   = req.params.username;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  const users = loadUsers();
  const user  = users.find(u => u.username === target);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  saveUsers(users);
  /* Clear their reset request if any */
  const reqs = loadResetRequests().filter(r => r.username !== target);
  saveResetRequests(reqs);
  console.log(`[superadmin] reset password for: ${target}`);
  res.json({ ok: true });
});

/* ── Forgot password requests ── */
const RESET_FILE = path.join(CACHE_DIR, '_reset_requests.json');
function loadResetRequests() {
  try { if (fs.existsSync(RESET_FILE)) return JSON.parse(fs.readFileSync(RESET_FILE, 'utf8')); } catch (_) {}
  return [];
}
function saveResetRequests(r) { fs.writeFileSync(RESET_FILE, JSON.stringify(r, null, 2)); }

app.post('/api/auth/forgot-password', (req, res) => {
  const u = (req.body.username || '').trim();
  if (!u) return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้' });
  if (!findUser(u)) return res.status(404).json({ error: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' });
  const reqs = loadResetRequests().filter(r => r.username !== u);
  reqs.push({ username: u, requestedAt: Date.now() });
  saveResetRequests(reqs);
  console.log(`[auth] reset request from: ${u}`);
  res.json({ ok: true });
});

app.get('/api/admin/reset-requests', authMiddleware, superAdminMiddleware, (req, res) => {
  res.json(loadResetRequests());
});

app.delete('/api/admin/reset-requests/:username', authMiddleware, superAdminMiddleware, (req, res) => {
  const reqs = loadResetRequests().filter(r => r.username !== req.params.username);
  saveResetRequests(reqs);
  res.json({ ok: true });
});

/* ── Super Admin: promote/demote ── */
app.patch('/api/admin/users/:username/role', authMiddleware, superAdminMiddleware, (req, res) => {
  const target = req.params.username;
  const { role } = req.body;
  if (!['user', 'superadmin'].includes(role)) return res.status(400).json({ error: 'role ต้องเป็น user หรือ superadmin' });
  const users = loadUsers();
  const user  = users.find(u => u.username === target);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  user.role = role;
  saveUsers(users);
  console.log(`[superadmin] set ${target} role → ${role}`);
  res.json({ ok: true, username: target, role });
});

/* ── Image proxy ── */
app.get('/api/img', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');
  try {
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15', 'Referer': 'https://www.tiktok.com/' }, maxRedirects: 5 });
    res.set('Content-Type', r.headers['content-type'] || 'image/jpeg').set('Cache-Control', 'public, max-age=86400').send(r.data);
  } catch (_) { res.status(502).send('proxy error'); }
});

/* ── TikTok info ── */
app.get('/api/tiktok-info/:username', async (req, res) => {
  const username = req.params.username.replace('@', '').trim();
  if (!username) return res.status(400).json({ error: 'username required' });
  const cached = loadFromCache(username);
  if (cached?.displayName && cached?.profilePicUrl?.startsWith('/api/avatar/'))
    return res.json({ username, displayName: cached.displayName, profilePicUrl: cached.profilePicUrl });
  const info = await fetchTikwmUser(username);
  const displayName   = info?.displayName || username;
  const profilePicUrl = info?.profilePicUrl || uiAvatar(username);
  if (!info) {
    try {
      const oEmbed = await axios.get(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (oEmbed.data?.author_name) { saveToCache(username, { uniqueId: username, displayName: oEmbed.data.author_name, profilePicUrl }); return res.json({ username, displayName: oEmbed.data.author_name, profilePicUrl }); }
    } catch (_) {}
  }
  saveToCache(username, { uniqueId: username, displayName, profilePicUrl });
  res.json({ username, displayName, profilePicUrl });
});

/* ── Cache avatar from URL ── */
app.post('/api/cache-avatar', authMiddleware, async (req, res) => {
  const { username, imageUrl } = req.body;
  if (!username || !imageUrl) return res.status(400).json({ error: 'username and imageUrl required' });
  const id    = username.trim().replace('@', '');
  const local = await downloadAvatar(id, imageUrl);
  if (!local) return res.status(502).json({ error: 'ดาวน์โหลดรูปไม่ได้' });
  const cached = loadFromCache(id);
  saveToCache(id, { ...(cached || {}), uniqueId: id, profilePicUrl: local });
  const st = getUserState(req.admin.username);
  if (st.players.has(id)) { st.players.get(id).profilePicUrl = local; saveUserPlayers(req.admin.username, st.players); broadcast(req.admin.username); }
  res.json({ ok: true, profilePicUrl: local });
});

/* ── Serve avatar images ── */
app.get('/api/avatar/:username', (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const safePath = path.join(AVATAR_DIR, `${safeFilename(username)}.jpg`);
  const rawPath  = path.join(AVATAR_DIR, `${username}.jpg`);
  const filePath = fs.existsSync(safePath) ? safePath : fs.existsSync(rawPath) ? rawPath : null;
  if (!filePath) return res.status(404).send('no avatar');
  res.set('Cache-Control', 'public, max-age=86400').set('Content-Type', 'image/jpeg');
  fs.createReadStream(filePath).pipe(res);
});

/* ── Live API ── */
app.post('/api/live/connect', authMiddleware, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'ต้องระบุ username' });
  connectLive(req.admin.username, username.replace('@', '').trim());
  res.json({ ok: true });
});
app.post('/api/live/disconnect', authMiddleware, (req, res) => {
  disconnectLive(req.admin.username);
  const st = getUserState(req.admin.username);
  st.commenters.clear(); broadcastCommenters(req.admin.username);
  res.json({ ok: true });
});
app.get('/api/live/status', authMiddleware, (req, res) => {
  const st = getUserState(req.admin.username);
  res.json({ status: st.liveStatus, host: st.liveHost, error: st.liveError, commenterCount: st.commenters.size });
});
app.get('/api/live/commenters', authMiddleware, (req, res) => {
  const st = getUserState(req.admin.username);
  res.json(Array.from(st.commenters.values()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_COMMENTERS));
});

/* ── External chat (bookmarklet) — needs ?u=adminUsername ── */
app.post('/api/external-chat', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const { uniqueId, nickname, profilePicUrl, adminUser } = req.body;
  if (!uniqueId || !adminUser) return res.status(400).json({ error: 'uniqueId and adminUser required' });
  const uid = String(uniqueId).trim().replace('@', '');
  const st  = getUserState(adminUser);
  const existing = st.commenters.get(uid);
  const raw = profilePicUrl || existing?.profilePicUrl || '';
  st.commenters.set(uid, {
    uniqueId: uid, nickname: nickname || existing?.nickname || uid,
    profilePicUrl: raw ? (raw.includes('tiktokcdn') || raw.includes('muscdn') ? `/api/img?url=${encodeURIComponent(raw)}` : raw) : `/api/img?url=${encodeURIComponent(`https://unavatar.io/tiktok/${uid}`)}`,
    lastSeen: Date.now(), msgCount: (existing?.msgCount || 0) + 1, lastMsg: existing?.lastMsg || '', source: 'bookmarklet',
  });
  const entry = st.commenters.get(uid);
  io.to(`room:${adminUser}`).emit('chatCapture', { uniqueId: entry.uniqueId, displayName: entry.nickname, profilePicUrl: entry.profilePicUrl });
  broadcastCommenters(adminUser);
  res.json({ ok: true, count: st.commenters.size });
});
app.options('/api/external-chat', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*').set('Access-Control-Allow-Headers', 'Content-Type').set('Access-Control-Allow-Methods', 'POST').sendStatus(204);
});

/* ── Bookmarklet ── */
app.get('/bookmarklet.js', (req, res) => {
  res.set('Content-Type', 'application/javascript').set('Cache-Control', 'no-cache').set('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../public/bookmarklet.js'));
});

/* ── Player API ── */
app.get('/api/players', (req, res) => {
  const u = req.query.u;
  if (!u) return res.status(400).json({ error: 'u required' });
  const st = getUserState(u);
  res.json(Array.from(st.players.values()).sort((a, b) => b.win - a.win).map((p, i) => ({ ...p, rank: i + 1 })));
});

app.post('/api/player', authMiddleware, async (req, res) => {
  const { username, displayName, profilePicUrl } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const id = username.trim().replace('@', '');
  const st = getUserState(req.admin.username);
  if (st.players.has(id)) return res.status(409).json({ error: 'มีผู้เล่นนี้อยู่แล้ว' });
  let pic = profilePicUrl || '', name = displayName || id;
  if (!pic || pic.includes('ui-avatars.com') || pic.includes('unavatar')) {
    const cached = loadFromCache(id);
    if (cached?.profilePicUrl?.startsWith('/api/avatar/')) {
      pic = cached.profilePicUrl; if (!displayName || displayName === id) name = cached.displayName || id;
    } else {
      const info = await fetchTikwmUser(id);
      if (info) { pic = info.profilePicUrl; if (!displayName || displayName === id) name = info.displayName; saveToCache(id, { uniqueId: id, displayName: name, profilePicUrl: pic }); }
    }
  }
  if (!pic) pic = uiAvatar(id);
  st.players.set(id, { id, username: id, displayName: name, profilePicUrl: pic, win: 0, joinedAt: Date.now() });
  saveUserPlayers(req.admin.username, st.players);
  broadcast(req.admin.username);
  res.json(st.players.get(id));
});

app.delete('/api/player/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const st = getUserState(req.admin.username);
  if (!st.players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  st.players.delete(id); saveUserPlayers(req.admin.username, st.players); broadcast(req.admin.username);
  res.json({ ok: true });
});

app.patch('/api/player/:id/win', authMiddleware, (req, res) => {
  const { id } = req.params;
  const st = getUserState(req.admin.username);
  if (!st.players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  const p = st.players.get(id);
  p.win = Math.max(0, p.win + (req.body.delta || 0));
  saveUserPlayers(req.admin.username, st.players); broadcast(req.admin.username);
  res.json(p);
});

app.post('/api/reset', authMiddleware, (req, res) => {
  const st = getUserState(req.admin.username);
  st.players.clear(); saveUserPlayers(req.admin.username, st.players); broadcast(req.admin.username);
  res.json({ ok: true });
});

app.post('/api/reset-top1', authMiddleware, (req, res) => {
  const st     = getUserState(req.admin.username);
  const sorted = Array.from(st.players.values()).sort((a, b) => b.win - a.win);
  const top    = sorted[0];
  st.top1Threshold = top ? { id: top.id, win: top.win } : null;
  io.to(`room:${req.admin.username}`).emit('top1Reset', st.top1Threshold);
  res.json({ ok: true });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
