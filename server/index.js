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
const nodemailer = require('nodemailer');
const { execSync } = require('child_process');

/* ── Puppeteer (lazy-loaded) ── */
let _puppeteerExtra = null;
function getPuppeteer() {
  if (_puppeteerExtra) return _puppeteerExtra;
  try {
    const pe = require('puppeteer-extra');
    const Stealth = require('puppeteer-extra-plugin-stealth');
    pe.use(Stealth());
    _puppeteerExtra = pe;
    return pe;
  } catch (e) {
    throw new Error('puppeteer-extra not installed: ' + e.message);
  }
}

function findChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  try { const p = execSync('which chromium 2>/dev/null').toString().trim(); if (p) return p; } catch (_) {}
  try { const p = execSync('which chromium-browser 2>/dev/null').toString().trim(); if (p) return p; } catch (_) {}
  try {
    const p = execSync('find /nix/store -maxdepth 6 -name "chromium" -type f 2>/dev/null | head -1').toString().trim();
    if (p) return p;
  } catch (_) {}
  return null;
}

/* ── Gmail / Nodemailer email helper ── */
function getMailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendVerificationEmail(toEmail, username, otp) {
  const transporter = getMailTransporter();
  if (!transporter) { console.warn('[mail] GMAIL_USER or GMAIL_APP_PASSWORD not set, skip verification email'); return false; }
  try {
    await transporter.sendMail({
      from: `"WIN Leaderboard" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '✅ WIN Leaderboard — ยืนยันอีเมลของคุณ',
      html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#060612;color:#fff;padding:40px 20px;text-align:center;max-width:480px;margin:0 auto;border-radius:16px;">
  <div style="font-size:48px;margin-bottom:12px;">🏆</div>
  <h2 style="color:#ffd700;margin:0 0 6px;">WIN Leaderboard</h2>
  <p style="color:#aaa;margin:0 0 28px;">ยืนยันอีเมลสำหรับบัญชี <strong style="color:#fff;">${username}</strong></p>
  <div style="background:#0d0d1f;border:2px solid rgba(254,44,85,0.4);border-radius:16px;padding:28px 20px;margin-bottom:24px;">
    <p style="color:#888;font-size:14px;margin:0 0 16px;">รหัสยืนยัน OTP ของคุณ</p>
    <div style="font-size:42px;font-weight:900;letter-spacing:16px;color:#fff;font-family:'Courier New',monospace;text-shadow:0 0 20px rgba(254,44,85,0.6);">
      ${otp}
    </div>
    <p style="color:#555;font-size:13px;margin:16px 0 0;">รหัสนี้จะหมดอายุใน <strong style="color:#ffd700;">10 นาที</strong></p>
  </div>
  <p style="color:#333;font-size:12px;margin:0;">หากคุณไม่ได้สมัคร กรุณาเพิกเฉยต่ออีเมลนี้</p>
</div>`,
    });
    console.log(`[mail] verification OTP sent to ${toEmail} for ${username}`);
    return true;
  } catch (e) { console.error('[mail] send failed:', e.message); return false; }
}

async function sendPasswordResetEmail(toEmail, username, resetToken) {
  const transporter = getMailTransporter();
  if (!transporter) { console.warn('[mail] GMAIL_USER or GMAIL_APP_PASSWORD not set, skip email'); return false; }
  const domain  = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
  const resetUrl = `${domain}/reset-password?token=${resetToken}`;
  try {
    await transporter.sendMail({
      from: `"WIN Leaderboard" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '🔑 WIN Leaderboard — รีเซ็ตรหัสผ่าน',
      html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#060612;color:#fff;padding:40px 20px;text-align:center;max-width:480px;margin:0 auto;border-radius:16px;">
  <div style="font-size:48px;margin-bottom:12px;">🏆</div>
  <h2 style="color:#ffd700;margin:0 0 8px;">WIN Leaderboard</h2>
  <p style="color:#aaa;margin-bottom:28px;">มีคนขอรีเซ็ตรหัสผ่านสำหรับบัญชี <strong style="color:#fff;">${username}</strong></p>
  <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#fe2c55,#c41e3a);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:700;margin-bottom:24px;">
    🔑 ตั้งรหัสผ่านใหม่
  </a>
  <p style="color:#555;font-size:13px;margin:0 0 8px;">ลิงก์นี้จะหมดอายุใน <strong style="color:#ffd700;">1 ชั่วโมง</strong></p>
  <p style="color:#333;font-size:12px;margin:0;">หากคุณไม่ได้ขอรีเซ็ต กรุณาเพิกเฉยต่ออีเมลนี้</p>
</div>`,
    });
    console.log(`[mail] reset email sent to ${toEmail} for ${username}`);
    return true;
  } catch (e) { console.error('[mail] send failed:', e.message); return false; }
}

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
      giftTracker:    new Map(),   // uniqueId → { uniqueId, displayName, profilePicUrl, diamonds }
      watchedGifters: new Map(),   // uniqueId → { uniqueId, displayName, profilePicUrl, profileUrl, giftLog[], totalDiamonds }
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
  socket.emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
}

/* ── TikTok Live (per-user) ── */
const MAX_RETRIES = 6;

function classifyError(msg) {
  if (msg.includes('UserOffline') || msg.includes('not live') || msg.includes('OFFLINE') || msg.includes('UserOfflineError')) return { code: 'OFFLINE', th: 'ผู้ใช้ไม่ได้ไลฟ์อยู่' };
  if (msg.includes('Room ID') || msg.includes('all sources') || msg.includes('InvalidResponse')) return { code: 'IP_BLOCKED', th: 'Cloud IP ถูกบล็อค — ต้องใช้ Euler Stream Sign API Key' };
  if (msg.includes('Access Denied') || msg.includes('403') || msg.includes('Forbidden')) return { code: 'IP_BLOCKED', th: 'IP ถูกบล็อค (403 Forbidden)' };
  if (msg.includes('Session') || msg.includes('Unauthorized') || msg.includes('401') || msg.includes('sessionid')) return { code: 'SESSION_EXPIRED', th: 'Session หมดอายุ' };
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) return { code: 'NETWORK', th: 'Network timeout / connection refused' };
  if (msg.includes('Sign') || msg.includes('signature') || msg.includes('eulerstream') || msg.includes('signApiKey')) return { code: 'SIGN_FAIL', th: 'Sign server ตอบสนองไม่ได้' };
  if (msg.includes('uniqueId') || msg.includes('InvalidUniqueId') || msg.includes('username')) return { code: 'INVALID_USER', th: 'username ไม่ถูกต้อง' };
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

  const sessionId  = process.env.TIKTOK_SESSION_ID;
  const signApiKey = process.env.TIKTOK_SIGN_API_KEY;
  const connOptions = {
    processInitialData: true,
    fetchRoomInfoOnConnect: true,
    enableExtendedGiftInfo: false,
    ...(signApiKey ? { signApiKey } : {}),
    ...(sessionId ? {
      session: { cookie: { value: { sessionId, ttTargetIdc: process.env.TIKTOK_TARGET_IDC || 'useast5' } } },
      authenticateWs: !!signApiKey,
    } : {}),
  };
  console.log(`[TikTok:${adminUser}] Connecting to @${tiktokUser}` + (attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '') + (signApiKey ? ' [signed]' : ' [no sign key]'));

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
      const noRetry  = code === 'OFFLINE' || code === 'SESSION_EXPIRED' || code === 'IP_BLOCKED' || code === 'INVALID_USER';
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

  /* ── Gift events → track diamonds per sender ── */
  const giftEvent = WebcastEvent?.GIFT || 'gift';
  conn.on(giftEvent, (data) => {
    const uid      = data?.user?.uniqueId || data?.uniqueId;
    const nickname = data?.user?.nickname  || data?.nickname || uid;
    const picRaw   = data?.user?.profilePictureUrl || data?.user?.avatarUrl || data?.profilePictureUrl;
    /* only count "streakEnd" or non-streaking gifts to avoid double-count */
    if (data?.giftType === 1 && !data?.repeatEnd) return;
    const diamonds = (data?.diamondCount || data?.gift?.diamondCount || 1) * (data?.repeatCount || 1);
    if (!uid || diamonds <= 0) return;
    const prev = st.giftTracker.get(uid) || { uniqueId: uid, displayName: nickname || uid, profilePicUrl: proxiedPic(picRaw, uid), diamonds: 0 };
    prev.diamonds += diamonds;
    if (nickname) prev.displayName = nickname;
    if (picRaw)   prev.profilePicUrl = proxiedPic(picRaw, uid);
    st.giftTracker.set(uid, prev);
    console.log(`[gift:${adminUser}] @${uid} total=${prev.diamonds} diamonds`);

    /* ── Watched gifter: record gift if this sender is being tracked ── */
    if (st.watchedGifters.has(uid)) {
      const wg = st.watchedGifters.get(uid);
      if (nickname) wg.displayName = nickname;
      if (picRaw)   wg.profilePicUrl = proxiedPic(picRaw, uid);
      const giftName = data?.gift?.name || data?.giftName || (data?.giftId ? `Gift #${data.giftId}` : 'ของขวัญ');
      const entry = { name: giftName, diamonds, count: data?.repeatCount || 1, ts: Date.now() };
      wg.giftLog.unshift(entry);
      if (wg.giftLog.length > 100) wg.giftLog.length = 100;
      wg.totalDiamonds += diamonds;
      const snapshot = Object.fromEntries([...st.watchedGifters.entries()]);
      io.to(`room:${adminUser}`).emit('watchedGiftAlert',     { ...wg, latestGift: entry });
      io.to(`room:${adminUser}`).emit('watchedGiftersUpdate', snapshot);
      console.log(`[watch:${adminUser}] @${uid} → ${giftName} ×${entry.count} (${diamonds}💎)`);
    }
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
  const u     = (req.body.username || '').trim();
  const p     = (req.body.password || '');
  const email = (req.body.email || '').trim().toLowerCase();
  if (!u || u.length < 3) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return res.status(400).json({ error: 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, _ . -' });
  if (p.length < 6)       return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' });

  const users   = loadUsers();
  if (users.find(x => x.username.toLowerCase() === u.toLowerCase())) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  if (users.find(x => x.email === email))                             return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });

  /* Clean up expired pending and check duplicates */
  const pending = cleanPending();
  const dupPending = pending.find(x => x.email === email || x.username.toLowerCase() === u.toLowerCase());
  if (dupPending) {
    /* Allow re-register to get a new OTP if pending exists */
    const filtered = pending.filter(x => x.email !== email && x.username.toLowerCase() !== u.toLowerCase());
    savePending(filtered);
  }

  /* Generate OTP */
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const hash   = await bcrypt.hash(p, 12);
  const expiry = Date.now() + 10 * 60 * 1000; // 10 min
  const newPending = loadPending();
  newPending.push({ username: u, passwordHash: hash, email, otp, expiry });
  savePending(newPending);

  /* Send OTP email */
  const sent = await sendVerificationEmail(email, u, otp);
  console.log(`[auth] register pending: ${u} (${email}) otp=${otp} sent=${sent}`);

  /* If mail not configured, skip verification for dev convenience */
  if (!sent) {
    const users2 = loadUsers();
    users2.push({ username: u, passwordHash: hash, email });
    saveUsers(users2);
    const token = jwt.sign({ username: u }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`[auth] (no mail) registered directly: ${u}`);
    return res.json({ ok: true, token, username: u, role: 'user', verified: true });
  }

  res.json({ ok: true, pending: true, email, username: u });
});

/* POST /api/auth/verify-email — confirm OTP */
app.post('/api/auth/verify-email', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const otp   = (req.body.otp || '').trim();
  if (!email || !otp) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

  const pending = cleanPending();
  const idx     = pending.findIndex(p => p.email === email);
  if (idx === -1) return res.status(400).json({ error: 'ไม่พบการสมัคร หรือหมดเวลาแล้ว กรุณาสมัครใหม่' });

  const entry = pending[idx];
  if (entry.otp !== otp) return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง' });

  /* Create account */
  const users = loadUsers();
  if (users.find(x => x.username.toLowerCase() === entry.username.toLowerCase()))
    return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาสมัครใหม่' });
  if (users.find(x => x.email === email))
    return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว กรุณาสมัครใหม่' });

  users.push({ username: entry.username, passwordHash: entry.passwordHash, email });
  saveUsers(users);

  /* Remove from pending */
  pending.splice(idx, 1);
  savePending(pending);

  const token = jwt.sign({ username: entry.username }, JWT_SECRET, { expiresIn: '30d' });
  console.log(`[auth] verified & registered: ${entry.username} (${email})`);
  res.json({ ok: true, token, username: entry.username, role: 'user' });
});

/* POST /api/auth/resend-verify — resend OTP */
app.post('/api/auth/resend-verify', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'ต้องระบุอีเมล' });

  const pending = cleanPending();
  const idx     = pending.findIndex(p => p.email === email);
  if (idx === -1) return res.status(400).json({ error: 'ไม่พบการสมัคร หรือหมดเวลาแล้ว กรุณาสมัครใหม่' });

  /* Generate fresh OTP & extend expiry */
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  pending[idx].otp    = otp;
  pending[idx].expiry = Date.now() + 10 * 60 * 1000;
  savePending(pending);

  const sent = await sendVerificationEmail(email, pending[idx].username, otp);
  console.log(`[auth] resend OTP to ${email} sent=${sent}`);
  res.json({ ok: true, sent });
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

/* ── Pending registrations (email verification) ── */
const PENDING_FILE = path.join(CACHE_DIR, '_pending_reg.json');
function loadPending() {
  try { if (fs.existsSync(PENDING_FILE)) return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch (_) {}
  return [];
}
function savePending(p) { fs.writeFileSync(PENDING_FILE, JSON.stringify(p, null, 2)); }
function cleanPending() {
  const alive = loadPending().filter(p => p.expiry > Date.now());
  savePending(alive);
  return alive;
}

/* ── Forgot password / Email reset tokens ── */
const RESET_FILE   = path.join(CACHE_DIR, '_reset_requests.json');
const TOKENS_FILE  = path.join(CACHE_DIR, '_reset_tokens.json');

function loadResetRequests() {
  try { if (fs.existsSync(RESET_FILE)) return JSON.parse(fs.readFileSync(RESET_FILE, 'utf8')); } catch (_) {}
  return [];
}
function saveResetRequests(r) { fs.writeFileSync(RESET_FILE, JSON.stringify(r, null, 2)); }

function loadResetTokens() {
  try { if (fs.existsSync(TOKENS_FILE)) return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch (_) {}
  return [];
}
function saveResetTokens(t) { fs.writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2)); }

/* POST /api/auth/forgot-password  — accepts email or username */
app.post('/api/auth/forgot-password', async (req, res) => {
  const raw = (req.body.email || req.body.username || '').trim().toLowerCase();
  if (!raw) return res.status(400).json({ error: 'กรุณาระบุอีเมลหรือชื่อผู้ใช้' });

  const users = loadUsers();
  const user  = users.find(u => u.email === raw || u.username.toLowerCase() === raw);

  /* Always respond OK to avoid user enumeration */
  if (!user || !user.email) {
    console.log(`[auth] forgot-password: not found or no email for "${raw}"`);
    return res.json({ ok: true });
  }

  /* Generate token */
  const token    = crypto.randomBytes(32).toString('hex');
  const expiry   = Date.now() + 60 * 60 * 1000; // 1 hour
  const tokens   = loadResetTokens().filter(t => t.username !== user.username && t.expiry > Date.now());
  tokens.push({ token, username: user.username, email: user.email, expiry });
  saveResetTokens(tokens);

  /* Also log a reset request for admin panel visibility */
  const reqs = loadResetRequests().filter(r => r.username !== user.username);
  reqs.push({ username: user.username, email: user.email, requestedAt: Date.now() });
  saveResetRequests(reqs);

  const sent = await sendPasswordResetEmail(user.email, user.username, token);
  console.log(`[auth] forgot-password: ${user.username} → ${user.email} (sent=${sent})`);
  res.json({ ok: true, sent });
});

/* GET /api/auth/reset-password?token=xxx  — validate token */
app.get('/api/auth/reset-password', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  const tokens = loadResetTokens();
  const entry  = tokens.find(t => t.token === token && t.expiry > Date.now());
  if (!entry) return res.status(400).json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' });
  res.json({ ok: true, username: entry.username });
});

/* POST /api/auth/reset-password  — set new password via token */
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'ข้อมูลไม่ครบหรือรหัสผ่านสั้นเกินไป' });

  const tokens = loadResetTokens();
  const idx    = tokens.findIndex(t => t.token === token && t.expiry > Date.now());
  if (idx === -1) return res.status(400).json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' });

  const { username } = tokens[idx];
  const users = loadUsers();
  const user  = users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  saveUsers(users);

  /* Invalidate token + clear reset request */
  tokens.splice(idx, 1);
  saveResetTokens(tokens);
  const reqs = loadResetRequests().filter(r => r.username !== username);
  saveResetRequests(reqs);

  console.log(`[auth] password reset OK for: ${username}`);
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

/* ── Super Admin: update user email ── */
app.patch('/api/admin/users/:username/email', authMiddleware, superAdminMiddleware, (req, res) => {
  const target = req.params.username;
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  const users = loadUsers();
  const user  = users.find(u => u.username === target);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  const dup = users.find(u => u.username !== target && u.email === email.trim().toLowerCase());
  if (dup) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
  user.email = email.trim().toLowerCase();
  saveUsers(users);
  console.log(`[superadmin] set email for ${target}: ${user.email}`);
  res.json({ ok: true, email: user.email });
});

/* ── User: update own email ── */
app.patch('/api/auth/email', authMiddleware, (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  const users = loadUsers();
  const user  = users.find(u => u.username === req.admin.username);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  const dup = users.find(u => u.username !== req.admin.username && u.email === email.trim().toLowerCase());
  if (dup) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
  user.email = email.trim().toLowerCase();
  saveUsers(users);
  console.log(`[auth] ${req.admin.username} updated email: ${user.email}`);
  res.json({ ok: true, email: user.email });
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

/* ══════════════════════════════════════
   TikTok QR Login / SSID Extractor
══════════════════════════════════════ */
const SSID_FILE = path.join(CACHE_DIR, '_tiktok_ssid.json');
function loadSsidData() {
  try { return JSON.parse(fs.readFileSync(SSID_FILE, 'utf8')); } catch (_) { return { ssid: '', updatedAt: null }; }
}
function saveSsidData(ssid) {
  fs.writeFileSync(SSID_FILE, JSON.stringify({ ssid, updatedAt: Date.now() }), 'utf8');
  process.env.TIKTOK_SESSION_ID = ssid;
}

// Load persisted SSID into env on startup
const _savedSsid = loadSsidData();
if (_savedSsid.ssid && !process.env.TIKTOK_SESSION_ID) {
  process.env.TIKTOK_SESSION_ID = _savedSsid.ssid;
  console.log('[tiktok-ssid] loaded persisted sessionid from cache');
}

let ttSession = null; // { browser, status, qrDataUrl, ssid, error, startedAt }

/* GET current saved SSID */
app.get('/api/admin/tiktok-ssid', authMiddleware, superAdminMiddleware, (req, res) => {
  const d = loadSsidData();
  const env = process.env.TIKTOK_SESSION_ID || '';
  const ssid = d.ssid || env;
  res.json({ ssid: ssid ? ssid.slice(0, 10) + '…' : '', hasSsid: !!ssid, updatedAt: d.updatedAt });
});

/* POST manual SSID */
app.post('/api/admin/tiktok-ssid', authMiddleware, superAdminMiddleware, (req, res) => {
  const { ssid } = req.body;
  if (!ssid || ssid.trim().length < 10) return res.status(400).json({ error: 'SSID ไม่ถูกต้อง' });
  saveSsidData(ssid.trim());
  console.log('[tiktok-ssid] manual update');
  res.json({ ok: true });
});

/* POST start QR login session */
app.post('/api/admin/tiktok-login/start', authMiddleware, superAdminMiddleware, async (req, res) => {
  // Close any existing session
  if (ttSession?.browser) {
    try { await ttSession.browser.close(); } catch (_) {}
  }
  const execPath = findChromiumPath();
  if (!execPath) return res.status(500).json({ error: 'ไม่พบ Chromium ในระบบ' });

  ttSession = { status: 'starting', qrDataUrl: null, ssid: null, error: null, startedAt: Date.now() };
  res.json({ ok: true });

  // Run async (don't await in request handler)
  (async () => {
    try {
      const puppeteer = getPuppeteer();
      const browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', '--disable-gpu',
          '--no-first-run', '--no-zygote',
          '--disable-extensions', '--disable-background-networking',
        ],
      });
      ttSession.browser = browser;
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      ttSession.status = 'navigating';
      console.log('[tiktok-login] navigating to QR login page...');
      await page.goto('https://www.tiktok.com/login/qrcode', { waitUntil: 'networkidle2', timeout: 30000 });

      ttSession.status = 'waiting-qr';

      // Wait for QR code element
      let qrEl = null;
      const qrSelectors = [
        'canvas[class*="qrcode"]',
        'canvas[class*="QR"]',
        'img[class*="qr"]',
        'div[class*="qrcode"] canvas',
        'div[class*="QRCode"] canvas',
        'canvas',
      ];
      for (const sel of qrSelectors) {
        try {
          qrEl = await page.waitForSelector(sel, { timeout: 8000 });
          if (qrEl) { console.log('[tiktok-login] found QR via:', sel); break; }
        } catch (_) {}
      }

      // Screenshot QR area
      const takeQrShot = async () => {
        try {
          if (qrEl) {
            const buf = await qrEl.screenshot({ type: 'png' });
            return `data:image/png;base64,${buf.toString('base64')}`;
          }
          // fallback: screenshot center of page
          const buf = await page.screenshot({ type: 'png', clip: { x: 340, y: 80, width: 600, height: 680 } });
          return `data:image/png;base64,${buf.toString('base64')}`;
        } catch (_) { return null; }
      };

      ttSession.qrDataUrl = await takeQrShot();
      ttSession.status = 'scan-qr';
      console.log('[tiktok-login] QR ready, waiting for scan...');

      // Poll for sessionid cookie (max 3 minutes)
      for (let i = 0; i < 180; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (!ttSession || ttSession.status === 'cancelled') break;

        const cookies = await page.cookies('https://www.tiktok.com');
        const sid = cookies.find(c => c.name === 'sessionid');
        if (sid?.value) {
          ttSession.ssid    = sid.value;
          ttSession.status  = 'success';
          saveSsidData(sid.value);
          console.log('[tiktok-login] ✅ sessionid extracted!');
          break;
        }
        // Refresh QR screenshot every 10s
        if (i % 10 === 9) {
          const freshQr = await takeQrShot();
          if (freshQr && ttSession) ttSession.qrDataUrl = freshQr;
        }
      }
      if (ttSession && ttSession.status === 'scan-qr') {
        ttSession.status = 'timeout';
        ttSession.error  = 'หมดเวลา กรุณาลองใหม่';
      }
    } catch (err) {
      console.error('[tiktok-login] error:', err.message);
      if (ttSession) { ttSession.status = 'error'; ttSession.error = err.message; }
    } finally {
      try { if (ttSession?.browser) { await ttSession.browser.close(); ttSession.browser = null; } } catch (_) {}
    }
  })();
});

/* GET session status + QR */
app.get('/api/admin/tiktok-login/status', authMiddleware, superAdminMiddleware, (req, res) => {
  if (!ttSession) return res.json({ status: 'idle' });
  const { status, qrDataUrl, ssid, error, startedAt } = ttSession;
  res.json({ status, qrDataUrl, error, startedAt, ssidPreview: ssid ? ssid.slice(0, 10) + '…' : null });
});

/* POST cancel session */
app.post('/api/admin/tiktok-login/cancel', authMiddleware, superAdminMiddleware, async (req, res) => {
  if (ttSession?.browser) {
    try { await ttSession.browser.close(); } catch (_) {}
  }
  ttSession = null;
  res.json({ ok: true });
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
/* ── Resolve short/full TikTok URL → username ── */
async function resolveUsername(input) {
  const raw = (input || '').trim();
  if (!raw.startsWith('http')) return raw.replace('@', '');

  // Follow redirects and extract final URL
  let finalUrl = raw;
  try {
    const resp = await axios.get(raw, {
      maxRedirects: 10,
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      validateStatus: () => true,
    });
    finalUrl = resp.request?.res?.responseUrl || resp.config?.url || raw;
  } catch (e) {
    finalUrl = raw; // fall through and try parsing as-is
  }

  // https://www.tiktok.com/@username/live  OR  /@username  patterns
  const m = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i) || finalUrl.match(/@([^/?#\s]+)/);
  if (m) return m[1];

  // If no @ found but it was a URL, return as-is and let the library handle it
  if (finalUrl.startsWith('http')) return finalUrl;

  throw new Error('ไม่พบ username ในลิงค์นี้ กรุณาตรวจสอบ URL');
}

app.post('/api/live/connect', authMiddleware, async (req, res) => {
  const { username: raw } = req.body;
  if (!raw) return res.status(400).json({ error: 'ต้องระบุ username หรือ URL' });
  try {
    const resolved = await resolveUsername(raw);
    console.log(`[connect] raw="${raw}" → resolved="${resolved}"`);
    connectLive(req.admin.username, resolved);
    res.json({ ok: true, resolved });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
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

/* ── Watched gifter endpoints ── */
app.get('/api/watch-gifters', authMiddleware, (req, res) => {
  const st = getUserState(req.admin.username);
  res.json(Object.fromEntries([...st.watchedGifters.entries()]));
});

app.post('/api/watch-gifter', authMiddleware, (req, res) => {
  const uid = (req.body.uniqueId || '').trim().replace(/^@/, '');
  if (!uid) return res.status(400).json({ error: 'กรุณาระบุ username' });
  const st = getUserState(req.admin.username);
  if (!st.watchedGifters.has(uid)) {
    st.watchedGifters.set(uid, {
      uniqueId: uid, displayName: uid, profilePicUrl: null,
      profileUrl: `https://www.tiktok.com/@${uid}`,
      giftLog: [], totalDiamonds: 0,
    });
  }
  io.to(`room:${req.admin.username}`).emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
  console.log(`[watch:${req.admin.username}] tracking @${uid}`);
  res.json({ ok: true });
});

app.delete('/api/watch-gifter/:uid', authMiddleware, (req, res) => {
  const st = getUserState(req.admin.username);
  st.watchedGifters.delete(req.params.uid);
  io.to(`room:${req.admin.username}`).emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
  res.json({ ok: true });
});

app.delete('/api/watch-gifter/:uid/log', authMiddleware, (req, res) => {
  const st = getUserState(req.admin.username);
  const wg = st.watchedGifters.get(req.params.uid);
  if (wg) { wg.giftLog = []; wg.totalDiamonds = 0; }
  io.to(`room:${req.admin.username}`).emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
  res.json({ ok: true });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
