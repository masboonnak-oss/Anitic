const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

/* ── PostgreSQL Pool ── */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ── Gmail / Nodemailer email helper ── */
function getMailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
}

async function sendVerificationEmail(toEmail, username, otp) {
  const transporter = getMailTransporter();
  if (!transporter) { console.warn('[mail] GMAIL_USER or GMAIL_APP_PASSWORD not set, skip verification email'); return false; }
  try {
    await transporter.sendMail({
      from: `"WIN Leaderboard" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '✅ WIN Leaderboard — ยืนยันอีเมลของคุณ',
      html: `<div style="font-family:'Segoe UI',Arial,sans-serif;background:#060612;color:#fff;padding:40px 20px;text-align:center;max-width:480px;margin:0 auto;border-radius:16px;"><div style="font-size:48px;margin-bottom:12px;">🏆</div><h2 style="color:#ffd700;margin:0 0 6px;">WIN Leaderboard</h2><p style="color:#aaa;margin:0 0 28px;">ยืนยันอีเมลสำหรับบัญชี <strong style="color:#fff;">${username}</strong></p><div style="background:#0d0d1f;border:2px solid rgba(254,44,85,0.4);border-radius:16px;padding:28px 20px;margin-bottom:24px;"><p style="color:#888;font-size:14px;margin:0 0 16px;">รหัสยืนยัน OTP ของคุณ</p><div style="font-size:42px;font-weight:900;letter-spacing:16px;color:#fff;font-family:'Courier New',monospace;text-shadow:0 0 20px rgba(254,44,85,0.6);">${otp}</div><p style="color:#555;font-size:13px;margin:16px 0 0;">รหัสนี้จะหมดอายุใน <strong style="color:#ffd700;">10 นาที</strong></p></div><p style="color:#333;font-size:12px;margin:0;">หากคุณไม่ได้สมัคร กรุณาเพิกเฉยต่ออีเมลนี้</p></div>`,
    });
    console.log(`[mail] verification OTP sent to ${toEmail} for ${username}`);
    return true;
  } catch (e) { console.error('[mail] send failed:', e.message); return false; }
}

async function sendPasswordResetEmail(toEmail, username, resetToken) {
  const transporter = getMailTransporter();
  if (!transporter) { console.warn('[mail] GMAIL_USER or GMAIL_APP_PASSWORD not set, skip email'); return false; }
  const domain   = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
  const resetUrl = `${domain}/reset-password?token=${resetToken}`;
  try {
    await transporter.sendMail({
      from: `"WIN Leaderboard" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: '🔑 WIN Leaderboard — รีเซ็ตรหัสผ่าน',
      html: `<div style="font-family:'Segoe UI',Arial,sans-serif;background:#060612;color:#fff;padding:40px 20px;text-align:center;max-width:480px;margin:0 auto;border-radius:16px;"><div style="font-size:48px;margin-bottom:12px;">🏆</div><h2 style="color:#ffd700;margin:0 0 8px;">WIN Leaderboard</h2><p style="color:#aaa;margin-bottom:28px;">มีคนขอรีเซ็ตรหัสผ่านสำหรับบัญชี <strong style="color:#fff;">${username}</strong></p><a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#fe2c55,#c41e3a);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:16px;font-weight:700;margin-bottom:24px;">🔑 ตั้งรหัสผ่านใหม่</a><p style="color:#555;font-size:13px;margin:0 0 8px;">ลิงก์นี้จะหมดอายุใน <strong style="color:#ffd700;">1 ชั่วโมง</strong></p><p style="color:#333;font-size:12px;margin:0;">หากคุณไม่ได้ขอรีเซ็ต กรุณาเพิกเฉยต่ออีเมลนี้</p></div>`,
    });
    console.log(`[mail] reset email sent to ${toEmail} for ${username}`);
    return true;
  } catch (e) { console.error('[mail] send failed:', e.message); return false; }
}

/* ── Dirs (still needed for avatar files) ── */
const CACHE_DIR  = path.join(__dirname, '../cache');
const AVATAR_DIR = path.join(__dirname, '../cache/avatars');
const USERS_DIR  = path.join(__dirname, '../cache/users');
[CACHE_DIR, AVATAR_DIR, USERS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

/* ── DB init: create tables ── */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_meta (
      id INTEGER PRIMARY KEY DEFAULT 1,
      jwt_secret TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS players (
      owner TEXT NOT NULL,
      id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      profile_pic_url TEXT,
      win INTEGER NOT NULL DEFAULT 0,
      joined_at BIGINT,
      PRIMARY KEY (owner, id)
    );
    CREATE TABLE IF NOT EXISTS profile_cache (
      unique_id TEXT PRIMARY KEY,
      display_name TEXT,
      profile_pic_url TEXT,
      updated_at BIGINT
    );
    CREATE TABLE IF NOT EXISTS pending_registrations (
      email TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      otp TEXT NOT NULL,
      expiry BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reset_tokens (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      expiry BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reset_requests (
      username TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      requested_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS streamdps_connections (
      owner TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      connected_at BIGINT,
      last_ping BIGINT
    );
  `);
  console.log('[db] tables ready');
}

/* ── JWT secret (stored in DB) ── */
let JWT_SECRET = '';
async function getOrCreateJwtSecret() {
  const res = await pool.query('SELECT jwt_secret FROM auth_meta WHERE id = 1');
  if (res.rows.length > 0) return res.rows[0].jwt_secret;
  const secret = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO auth_meta (id, jwt_secret) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [secret]);
  return secret;
}

/* ── DB: Users ── */
async function loadUsers() {
  const res = await pool.query('SELECT username, password_hash, email, role FROM app_users ORDER BY username');
  return res.rows.map(r => ({ username: r.username, passwordHash: r.password_hash, email: r.email, role: r.role || 'user' }));
}
async function findUser(username) {
  const res = await pool.query('SELECT username, password_hash, email, role FROM app_users WHERE username = $1', [username]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return { username: r.username, passwordHash: r.password_hash, email: r.email, role: r.role || 'user' };
}
async function saveUser(user) {
  await pool.query(
    'INSERT INTO app_users (username, password_hash, email, role) VALUES ($1,$2,$3,$4) ON CONFLICT (username) DO UPDATE SET password_hash=$2, email=$3, role=$4',
    [user.username, user.passwordHash, user.email || null, user.role || 'user']
  );
}
async function deleteUserFromDb(username) {
  await pool.query('DELETE FROM app_users WHERE username = $1', [username]);
  await pool.query('DELETE FROM players WHERE owner = $1', [username]);
}

/* ── DB: Players ── */
async function loadUserPlayersFromDb(owner) {
  const res = await pool.query(
    'SELECT id, username, display_name, profile_pic_url, win, joined_at FROM players WHERE owner = $1 ORDER BY win DESC',
    [owner]
  );
  const map = new Map();
  res.rows.forEach(r => {
    map.set(r.id, { id: r.id, username: r.username, displayName: r.display_name, profilePicUrl: r.profile_pic_url, win: r.win, joinedAt: Number(r.joined_at) });
  });
  return map;
}

async function saveUserPlayers(owner, players) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM players WHERE owner = $1', [owner]);
    for (const p of players.values()) {
      await client.query(
        'INSERT INTO players (owner, id, username, display_name, profile_pic_url, win, joined_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [owner, p.id, p.username, p.displayName || p.username, p.profilePicUrl || null, p.win || 0, p.joinedAt || Date.now()]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`[db:saveUserPlayers:${owner}]`, e.message);
  } finally {
    client.release();
  }
}

/* ── DB: Profile cache ── */
async function saveToCache(uniqueId, data) {
  try {
    await pool.query(
      'INSERT INTO profile_cache (unique_id, display_name, profile_pic_url, updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT (unique_id) DO UPDATE SET display_name=COALESCE($2, profile_cache.display_name), profile_pic_url=COALESCE($3, profile_cache.profile_pic_url), updated_at=$4',
      [uniqueId, data.displayName || null, data.profilePicUrl || null, Date.now()]
    );
  } catch (e) { console.warn('[db:saveToCache]', e.message); }
}
async function loadFromCache(uniqueId) {
  try {
    const res = await pool.query('SELECT display_name, profile_pic_url FROM profile_cache WHERE unique_id = $1', [uniqueId]);
    if (res.rows.length > 0) return { displayName: res.rows[0].display_name, profilePicUrl: res.rows[0].profile_pic_url };
  } catch (e) { console.warn('[db:loadFromCache]', e.message); }
  return null;
}

/* ── DB: Pending registrations ── */
async function loadPending() {
  const res = await pool.query('SELECT email, username, password_hash, otp, expiry FROM pending_registrations');
  return res.rows.map(r => ({ email: r.email, username: r.username, passwordHash: r.password_hash, otp: r.otp, expiry: Number(r.expiry) }));
}
async function upsertPending(entry) {
  await pool.query(
    'INSERT INTO pending_registrations (email, username, password_hash, otp, expiry) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET username=$2, password_hash=$3, otp=$4, expiry=$5',
    [entry.email, entry.username, entry.passwordHash, entry.otp, entry.expiry]
  );
}
async function deletePending(email) {
  await pool.query('DELETE FROM pending_registrations WHERE email = $1', [email]);
}
async function cleanPending() {
  await pool.query('DELETE FROM pending_registrations WHERE expiry <= $1', [Date.now()]);
  return loadPending();
}

/* ── DB: Reset tokens ── */
async function loadResetTokens() {
  const res = await pool.query('SELECT token, username, email, expiry FROM reset_tokens WHERE expiry > $1', [Date.now()]);
  return res.rows.map(r => ({ token: r.token, username: r.username, email: r.email, expiry: Number(r.expiry) }));
}
async function saveResetToken(entry) {
  await pool.query('DELETE FROM reset_tokens WHERE username = $1', [entry.username]);
  await pool.query(
    'INSERT INTO reset_tokens (token, username, email, expiry) VALUES ($1,$2,$3,$4) ON CONFLICT (token) DO NOTHING',
    [entry.token, entry.username, entry.email, entry.expiry]
  );
}
async function deleteResetToken(token) {
  await pool.query('DELETE FROM reset_tokens WHERE token = $1', [token]);
}

/* ── DB: Reset requests ── */
async function loadResetRequests() {
  const res = await pool.query('SELECT username, email, requested_at FROM reset_requests ORDER BY requested_at DESC');
  return res.rows.map(r => ({ username: r.username, email: r.email, requestedAt: Number(r.requested_at) }));
}
async function saveResetRequest(entry) {
  await pool.query(
    'INSERT INTO reset_requests (username, email, requested_at) VALUES ($1,$2,$3) ON CONFLICT (username) DO UPDATE SET email=$2, requested_at=$3',
    [entry.username, entry.email, entry.requestedAt]
  );
}
async function deleteResetRequest(username) {
  await pool.query('DELETE FROM reset_requests WHERE username = $1', [username]);
}

/* ── Migrate old JSON files → DB (one-time) ── */
async function migrateFromFiles() {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM app_users');
    if (parseInt(rows[0].count) > 0) return; // already migrated

    const usersFile = path.join(CACHE_DIR, '_users.json');
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      for (const u of users) {
        await pool.query(
          'INSERT INTO app_users (username, password_hash, email, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [u.username, u.passwordHash, u.email || null, u.role || 'user']
        );
      }
      console.log(`[migrate] migrated ${users.length} users from files`);
    }

    if (fs.existsSync(USERS_DIR)) {
      const userDirs = fs.readdirSync(USERS_DIR);
      for (const uname of userDirs) {
        const pf = path.join(USERS_DIR, uname, '_players.json');
        if (!fs.existsSync(pf)) continue;
        const players = JSON.parse(fs.readFileSync(pf, 'utf8'));
        for (const p of players) {
          if (!p?.id) continue;
          await pool.query(
            'INSERT INTO players (owner, id, username, display_name, profile_pic_url, win, joined_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',
            [uname, p.id, p.username, p.displayName, p.profilePicUrl, p.win || 0, p.joinedAt || Date.now()]
          );
        }
        console.log(`[migrate] migrated ${players.length} players for ${uname}`);
      }
    }
  } catch (e) { console.error('[migrate] error:', e.message); }
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

/* ── Per-user in-memory state ── */
const userStates  = new Map();
const loadedUsers = new Set();
const MAX_COMMENTERS = 60;

function getUserState(username) {
  if (!userStates.has(username)) {
    userStates.set(username, {
      players:        new Map(),
      currentKingId:  null,
      top1Threshold:  null,
      liveConnection: null,
      liveHost:       null,
      liveStatus:     'disconnected',
      liveError:      null,
      commenters:     new Map(),
      giftTracker:    new Map(),
      watchedGifters: new Map(),
      retryTimer:     null,
      retryAttempt:   0,
    });
  }
  return userStates.get(username);
}

async function ensureUserLoaded(username) {
  if (loadedUsers.has(username)) return;
  loadedUsers.add(username);
  try {
    const players = await loadUserPlayersFromDb(username);
    if (players.size > 0) {
      const st = getUserState(username);
      st.players = players;
      const sorted = Array.from(players.values()).sort((a, b) => b.win - a.win);
      if (sorted.length > 0) st.currentKingId = sorted[0].id;
      console.log(`[db:${username}] loaded ${players.size} players`);
    }
  } catch (e) {
    loadedUsers.delete(username); // allow retry
    console.error(`[db:ensureUserLoaded:${username}]`, e.message);
  }
}

/* ── Express + Socket.IO ── */
let TikTokLiveConnection, WebcastEvent;
try {
  const pkg = require('tiktok-live-connector');
  TikTokLiveConnection = pkg.TikTokLiveConnection;
  WebcastEvent = pkg.WebcastEvent;
  if (pkg.SignConfig && process.env.EULER_API_KEY) {
    pkg.SignConfig.apiKey = process.env.EULER_API_KEY;
    console.log('[tiktok] Euler Sign API Key loaded ✓');
  }
} catch (e) { console.log('tiktok-live-connector not available:', e.message); }

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json());

/* ── Throttled broadcast (max once per 80ms per user) ── */
const broadcastTimers = new Map();
function broadcast(username) {
  if (broadcastTimers.has(username)) return;
  broadcastTimers.set(username, setTimeout(() => {
    broadcastTimers.delete(username);
    _doBroadcast(username);
  }, 80));
}
function _doBroadcast(username) {
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

/* ── TikTok Live ── */
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
    saveToCache(uid, { displayName, profilePicUrl: picUrl }).catch(() => {});
    io.to(`room:${adminUser}`).emit('chatCapture', { uniqueId: uid, displayName, profilePicUrl: picUrl });
    io.to(`room:${adminUser}`).emit('tiktokChat', { uniqueId: uid, displayName, profilePicUrl: picUrl, comment: data?.comment || '', ts: Date.now() });
    if (st.commenters.size > MAX_COMMENTERS * 2) {
      const entries = [...st.commenters.entries()].sort((a, b) => b[1].lastSeen - a[1].lastSeen);
      st.commenters = new Map(entries.slice(0, MAX_COMMENTERS));
    }
    broadcastCommenters(adminUser);
  });

  const giftEvent = WebcastEvent?.GIFT || 'gift';
  conn.on(giftEvent, (data) => {
    const uid      = data?.user?.uniqueId || data?.uniqueId;
    const nickname = data?.user?.nickname  || data?.nickname || uid;
    const picRaw   = data?.user?.profilePictureUrl || data?.user?.avatarUrl || data?.profilePictureUrl;
    if (data?.giftType === 1 && !data?.repeatEnd) return;
    const diamonds = (data?.diamondCount || data?.gift?.diamondCount || 1) * (data?.repeatCount || 1);
    if (!uid || diamonds <= 0) return;
    const prev = st.giftTracker.get(uid) || { uniqueId: uid, displayName: nickname || uid, profilePicUrl: proxiedPic(picRaw, uid), diamonds: 0 };
    prev.diamonds += diamonds;
    if (nickname) prev.displayName = nickname;
    if (picRaw)   prev.profilePicUrl = proxiedPic(picRaw, uid);
    st.giftTracker.set(uid, prev);

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
    }
    // Broadcast raw gift event for Gift Connector page
    const giftName = data?.gift?.name || data?.giftName || (data?.giftId ? `Gift #${data.giftId}` : 'ของขวัญ');
    io.to(`room:${adminUser}`).emit('tiktokGift', {
      uniqueId: uid, displayName: prev.displayName, profilePicUrl: prev.profilePicUrl,
      giftName, diamonds, repeatCount: data?.repeatCount || 1, giftId: data?.giftId, ts: Date.now(),
    });
  });

  // Like events
  const likeEvent = WebcastEvent?.LIKE || 'like';
  conn.on(likeEvent, (data) => {
    if (typeof data?.totalLikeCount === 'number') {
      io.to(`room:${adminUser}`).emit('tiktokLike', { totalLikeCount: data.totalLikeCount, likeCount: data.likeCount || 0 });
    }
  });

  // Viewer count
  conn.on('roomUser', (data) => {
    if (typeof data?.viewerCount === 'number') {
      io.to(`room:${adminUser}`).emit('tiktokViewers', { viewerCount: data.viewerCount });
    }
  });

  // Member join
  conn.on('member', (data) => {
    const mUid   = data?.user?.uniqueId || data?.uniqueId;
    const mNick  = data?.user?.nickname  || data?.nickname || mUid;
    const picRaw = data?.user?.profilePictureUrl || data?.user?.avatarUrl;
    const level  = data?.user?.fansClub?.memberLevel || data?.user?.level || 0;
    if (mUid) io.to(`room:${adminUser}`).emit('tiktokMember', {
      uniqueId: mUid, displayName: mNick,
      profilePicUrl: picRaw ? proxiedPic(picRaw, mUid) : null,
      level, ts: Date.now(),
    });
  });

  conn.on('disconnected', () => {
    if (st.liveStatus === 'connected') { st.liveStatus = 'error'; st.liveError = 'การเชื่อมต่อถูกตัด'; broadcastLiveStatus(adminUser); }
  });
}

/* ── Socket.IO ── */
io.on('connection', (socket) => {
  socket.on('authenticate', async ({ token }) => {
    try {
      const admin = jwt.verify(token, JWT_SECRET);
      socket.username = admin.username;
      socket.join(`room:${admin.username}`);
      await ensureUserLoaded(admin.username);
      sendInitialState(socket, admin.username);
    } catch (_) { socket.emit('authError', { error: 'invalid token' }); }
  });

  socket.on('joinRoom', async ({ username }) => {
    if (!username) return;
    socket.join(`room:${username}`);
    await ensureUserLoaded(username);
    sendInitialState(socket, username);
  });

  /* ── Per-socket TikTok connection (standalone / OBS mode) ── */
  socket.on('setUniqueId', async (uniqueId, options) => {
    if (typeof options === 'object' && options) {
      delete options.requestOptions;
      delete options.websocketOptions;
    } else {
      options = {};
    }
    if (socket._tiktokConn) {
      try { socket._tiktokConn.disconnect(); } catch (_) {}
      socket._tiktokConn = null;
    }
    if (!TikTokLiveConnection) {
      socket.emit('tiktokDisconnected', 'TikTok connector ไม่พร้อมใช้งาน');
      return;
    }
    try {
      const conn = new TikTokLiveConnection(uniqueId, { processInitialData: true, fetchRoomInfoOnConnect: true });
      socket._tiktokConn = conn;

      conn.connect()
        .then(state => { socket.emit('tiktokConnected', state); })
        .catch(err => {
          let msg = err?.message || String(err);
          if (Array.isArray(err?.errors) && err.errors.length > 0) {
            msg += ': ' + err.errors.map(e => e.message || String(e)).filter(Boolean).join(' | ');
          }
          socket.emit('tiktokDisconnected', msg);
          socket._tiktokConn = null;
        });

      conn.on(WebcastEvent?.CHAT || 'chat', (data) => {
        const uid  = data?.user?.uniqueId || data?.uniqueId;
        const nick = data?.user?.nickname  || uid;
        const pic  = proxiedPic(data?.user?.profilePictureUrl, uid);
        socket.emit('chat', { uniqueId: uid, displayName: nick, profilePicUrl: pic, comment: data?.comment || '', ts: Date.now() });
      });

      conn.on(WebcastEvent?.GIFT || 'gift', (data) => {
        if (data?.giftType === 1 && !data?.repeatEnd) return;
        const uid = data?.user?.uniqueId || data?.uniqueId;
        const diamonds = (data?.diamondCount || data?.gift?.diamondCount || 1) * (data?.repeatCount || 1);
        const giftPayload = {
          uniqueId: uid, displayName: data?.user?.nickname || uid,
          profilePicUrl: proxiedPic(data?.user?.profilePictureUrl, uid),
          giftName: data?.gift?.name || data?.giftName || 'ของขวัญ',
          diamonds, repeatCount: data?.repeatCount || 1, ts: Date.now(),
        };
        socket.emit('gift', giftPayload);
        /* broadcast to overlay(s) listening on this room */
        io.to(`room:${uniqueId}`).emit('tiktokGift', giftPayload);
      });

      conn.on(WebcastEvent?.LIKE || 'like', (data) => {
        socket.emit('like', { totalLikeCount: data?.totalLikeCount, likeCount: data?.likeCount });
      });

      conn.on('roomUser', (data) => {
        socket.emit('roomUser', { viewerCount: data?.viewerCount });
      });

      conn.on('member', (data) => {
        const mUid   = data?.user?.uniqueId;
        const mNick  = data?.user?.nickname || mUid;
        const picRaw = data?.user?.profilePictureUrl || data?.user?.avatarUrl;
        const level  = data?.user?.fansClub?.memberLevel || data?.user?.level || 0;
        const memberPayload = {
          uniqueId: mUid, displayName: mNick,
          profilePicUrl: picRaw ? proxiedPic(picRaw, mUid) : null,
          level,
        };
        socket.emit('member', memberPayload);
        /* broadcast to overlay(s) listening on this room */
        io.to(`room:${uniqueId}`).emit('tiktokMember', memberPayload);
      });

      conn.on('disconnected', () => {
        socket.emit('tiktokDisconnected', 'การเชื่อมต่อถูกตัด');
      });

    } catch (err) {
      socket.emit('tiktokDisconnected', err?.message || 'เชื่อมต่อไม่ได้');
    }
  });

  socket.on('disconnect_tiktok', () => {
    if (socket._tiktokConn) {
      try { socket._tiktokConn.disconnect(); } catch (_) {}
      socket._tiktokConn = null;
    }
  });

  socket.on('disconnect', () => {
    if (socket._tiktokConn) {
      try { socket._tiktokConn.disconnect(); } catch (_) {}
      socket._tiktokConn = null;
    }
  });
});

/* ── StreamDPS proxy (public, no auth) ── */
app.get('/api/proxy/streamdps', async (req, res) => {
  const username = String(req.query.username || '').trim().replace(/^@/, '');
  if (!username) return res.status(400).send('username required');
  try {
    const url = `https://streamdps.com/tiktok-widgets/gifts/?username=${encodeURIComponent(username)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://streamdps.com/',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
    });
    let html = await resp.text();
    html = html.replace(/(<head[^>]*>)/i, '$1<base href="https://streamdps.com/">');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('Content-Security-Policy');
    res.send(html);
  } catch (err) {
    console.error('[proxy:streamdps]', err.message);
    res.status(502).send(`<html><body style="background:#0a0a15;color:#ff4d6d;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><div style="font-size:32px">⚠️</div><div>StreamDPS proxy error</div><div style="font-size:12px;color:#666">${err.message}</div></body></html>`);
  }
});

/* ── Auth middleware ── */
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาล็อคอินก่อน' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch (_) { res.status(401).json({ error: 'Token หมดอายุ กรุณาล็อคอินใหม่' }); }
}
function superAdminMiddleware(req, res, next) {
  findUser(req.admin.username).then(user => {
    if (user?.role !== 'superadmin') return res.status(403).json({ error: 'เฉพาะ Super Admin เท่านั้น' });
    next();
  }).catch(() => res.status(403).json({ error: 'เฉพาะ Super Admin เท่านั้น' }));
}

/* ── Auth routes ── */
app.post('/api/auth/register', async (req, res) => {
  const u     = (req.body.username || '').trim();
  const p     = (req.body.password || '');
  const email = (req.body.email || '').trim().toLowerCase();
  if (!u || u.length < 3)  return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return res.status(400).json({ error: 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, _ . -' });
  if (p.length < 6)         return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'กรุณาระบุอีเมลที่ถูกต้อง' });

  const [existUser, existEmail] = await Promise.all([
    pool.query('SELECT 1 FROM app_users WHERE LOWER(username) = LOWER($1)', [u]),
    pool.query('SELECT 1 FROM app_users WHERE email = $1', [email]),
  ]);
  if (existUser.rows.length > 0) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  if (existEmail.rows.length > 0) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });

  await cleanPending();
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const hash   = await bcrypt.hash(p, 12);
  const expiry = Date.now() + 10 * 60 * 1000;
  await upsertPending({ email, username: u, passwordHash: hash, otp, expiry });

  const sent = await sendVerificationEmail(email, u, otp);
  console.log(`[auth] register pending: ${u} (${email}) sent=${sent}`);

  if (!sent) {
    await saveUser({ username: u, passwordHash: hash, email, role: 'user' });
    await deletePending(email);
    const token = jwt.sign({ username: u }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ ok: true, token, username: u, role: 'user', verified: true });
  }
  res.json({ ok: true, pending: true, email, username: u });
});

app.post('/api/auth/verify-email', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const otp   = (req.body.otp || '').trim();
  if (!email || !otp) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

  await cleanPending();
  const pending = await loadPending();
  const entry   = pending.find(p => p.email === email);
  if (!entry) return res.status(400).json({ error: 'ไม่พบการสมัคร หรือหมดเวลาแล้ว กรุณาสมัครใหม่' });
  if (entry.otp !== otp) return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง' });

  const [dupeUser, dupeEmail] = await Promise.all([
    pool.query('SELECT 1 FROM app_users WHERE LOWER(username) = LOWER($1)', [entry.username]),
    pool.query('SELECT 1 FROM app_users WHERE email = $1', [email]),
  ]);
  if (dupeUser.rows.length > 0)  return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาสมัครใหม่' });
  if (dupeEmail.rows.length > 0) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว กรุณาสมัครใหม่' });

  await saveUser({ username: entry.username, passwordHash: entry.passwordHash, email, role: 'user' });
  await deletePending(email);

  const token = jwt.sign({ username: entry.username }, JWT_SECRET, { expiresIn: '30d' });
  console.log(`[auth] verified & registered: ${entry.username} (${email})`);
  res.json({ ok: true, token, username: entry.username, role: 'user' });
});

app.post('/api/auth/resend-verify', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'ต้องระบุอีเมล' });

  await cleanPending();
  const pending = await loadPending();
  const entry   = pending.find(p => p.email === email);
  if (!entry) return res.status(400).json({ error: 'ไม่พบการสมัคร หรือหมดเวลาแล้ว กรุณาสมัครใหม่' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await upsertPending({ ...entry, otp, expiry: Date.now() + 10 * 60 * 1000 });

  const sent = await sendVerificationEmail(email, entry.username, otp);
  res.json({ ok: true, sent });
});

app.post('/api/auth/login', async (req, res) => {
  const u    = (req.body.username || '').trim();
  const user = await findUser(u);
  if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  const ok = await bcrypt.compare(req.body.password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  const token = jwt.sign({ username: u }, JWT_SECRET, { expiresIn: '30d' });
  console.log(`[auth] login: ${u}`);
  res.json({ ok: true, token, username: u, role: user.role || 'user' });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await findUser(req.admin.username);
  res.json({ ok: true, username: req.admin.username, role: user?.role || 'user' });
});

app.patch('/api/auth/email', authMiddleware, async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  const dup = await pool.query('SELECT 1 FROM app_users WHERE email=$1 AND username!=$2', [email.trim().toLowerCase(), req.admin.username]);
  if (dup.rows.length > 0) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
  await pool.query('UPDATE app_users SET email=$1 WHERE username=$2', [email.trim().toLowerCase(), req.admin.username]);
  res.json({ ok: true, email: email.trim().toLowerCase() });
});

/* ── Super Admin routes ── */
app.get('/api/admin/users', authMiddleware, superAdminMiddleware, async (req, res) => {
  const users = await loadUsers();
  const result = await Promise.all(users.map(async u => {
    const { rows } = await pool.query('SELECT COUNT(*) FROM players WHERE owner=$1', [u.username]);
    return { username: u.username, role: u.role, playerCount: parseInt(rows[0].count) };
  }));
  res.json(result);
});

app.delete('/api/admin/users/:username', authMiddleware, superAdminMiddleware, async (req, res) => {
  const target = req.params.username;
  if (target === req.admin.username) return res.status(400).json({ error: 'ไม่สามารถลบตัวเองได้' });
  const user = await findUser(target);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

  if (userStates.has(target)) {
    const st = userStates.get(target);
    if (st.retryTimer) clearTimeout(st.retryTimer);
    if (st.liveConnection) { try { st.liveConnection.disconnect(); } catch (_) {} }
    userStates.delete(target);
    loadedUsers.delete(target);
  }

  await deleteUserFromDb(target);
  try {
    const userDir = path.join(USERS_DIR, target);
    if (fs.existsSync(userDir)) fs.rmSync(userDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`[superadmin] deleted user: ${target}`);
  res.json({ ok: true });
});

app.post('/api/admin/users/:username/reset-password', authMiddleware, superAdminMiddleware, async (req, res) => {
  const target = req.params.username;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  const user = await findUser(target);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await saveUser(user);
  await deleteResetRequest(target);
  res.json({ ok: true });
});

app.patch('/api/admin/users/:username/role', authMiddleware, superAdminMiddleware, async (req, res) => {
  const target = req.params.username;
  const { role } = req.body;
  if (!['user', 'superadmin'].includes(role)) return res.status(400).json({ error: 'role ต้องเป็น user หรือ superadmin' });
  const user = await findUser(target);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  user.role = role;
  await saveUser(user);
  res.json({ ok: true, username: target, role });
});

app.patch('/api/admin/users/:username/email', authMiddleware, superAdminMiddleware, async (req, res) => {
  const target = req.params.username;
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  const dup = await pool.query('SELECT 1 FROM app_users WHERE email=$1 AND username!=$2', [email.trim().toLowerCase(), target]);
  if (dup.rows.length > 0) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' });
  await pool.query('UPDATE app_users SET email=$1 WHERE username=$2', [email.trim().toLowerCase(), target]);
  res.json({ ok: true, email: email.trim().toLowerCase() });
});

app.get('/api/admin/reset-requests', authMiddleware, superAdminMiddleware, async (req, res) => {
  res.json(await loadResetRequests());
});
app.delete('/api/admin/reset-requests/:username', authMiddleware, superAdminMiddleware, async (req, res) => {
  await deleteResetRequest(req.params.username);
  res.json({ ok: true });
});

/* ── Password reset ── */
app.post('/api/auth/forgot-password', async (req, res) => {
  const raw = (req.body.email || req.body.username || '').trim().toLowerCase();
  if (!raw) return res.status(400).json({ error: 'กรุณาระบุอีเมลหรือชื่อผู้ใช้' });
  const users = await loadUsers();
  const user  = users.find(u => u.email === raw || u.username.toLowerCase() === raw);
  if (!user || !user.email) { return res.json({ ok: true }); }

  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + 60 * 60 * 1000;
  await saveResetToken({ token, username: user.username, email: user.email, expiry });
  await saveResetRequest({ username: user.username, email: user.email, requestedAt: Date.now() });

  const sent = await sendPasswordResetEmail(user.email, user.username, token);
  res.json({ ok: true, sent });
});

app.get('/api/auth/reset-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  const tokens = await loadResetTokens();
  const entry  = tokens.find(t => t.token === token);
  if (!entry) return res.status(400).json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' });
  res.json({ ok: true, username: entry.username });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'ข้อมูลไม่ครบหรือรหัสผ่านสั้นเกินไป' });
  const tokens = await loadResetTokens();
  const entry  = tokens.find(t => t.token === token);
  if (!entry) return res.status(400).json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' });
  const user = await findUser(entry.username);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await saveUser(user);
  await deleteResetToken(token);
  await deleteResetRequest(entry.username);
  console.log(`[auth] password reset OK for: ${entry.username}`);
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
  const cached = await loadFromCache(username);
  if (cached?.profilePicUrl?.startsWith('/api/avatar/'))
    return res.json({ username, displayName: cached.displayName, profilePicUrl: cached.profilePicUrl });
  const info = await fetchTikwmUser(username);
  const displayName   = info?.displayName || username;
  const profilePicUrl = info?.profilePicUrl || uiAvatar(username);
  if (!info) {
    try {
      const oEmbed = await axios.get(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${username}`, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (oEmbed.data?.author_name) { await saveToCache(username, { displayName: oEmbed.data.author_name, profilePicUrl }); return res.json({ username, displayName: oEmbed.data.author_name, profilePicUrl }); }
    } catch (_) {}
  }
  await saveToCache(username, { displayName, profilePicUrl });
  res.json({ username, displayName, profilePicUrl });
});

/* ── Cache avatar from URL ── */
app.post('/api/cache-avatar', authMiddleware, async (req, res) => {
  const { username, imageUrl } = req.body;
  if (!username || !imageUrl) return res.status(400).json({ error: 'username and imageUrl required' });
  const id    = username.trim().replace('@', '');
  const local = await downloadAvatar(id, imageUrl);
  if (!local) return res.status(502).json({ error: 'ดาวน์โหลดรูปไม่ได้' });
  const cached = await loadFromCache(id);
  await saveToCache(id, { ...(cached || {}), profilePicUrl: local });
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  if (st.players.has(id)) {
    st.players.get(id).profilePicUrl = local;
    saveUserPlayers(req.admin.username, st.players).catch(() => {});
    broadcast(req.admin.username);
  }
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
async function resolveUsername(input) {
  const raw = (input || '').trim();
  if (!raw.startsWith('http')) return raw.replace('@', '');
  let finalUrl = raw;
  try {
    const resp = await axios.get(raw, { maxRedirects: 10, timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true });
    finalUrl = resp.request?.res?.responseUrl || resp.config?.url || raw;
  } catch (e) { finalUrl = raw; }
  const m = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i) || finalUrl.match(/@([^/?#\s]+)/);
  if (m) return m[1];
  if (finalUrl.startsWith('http')) return finalUrl;
  throw new Error('ไม่พบ username ในลิงค์นี้ กรุณาตรวจสอบ URL');
}

app.post('/api/live/connect', authMiddleware, async (req, res) => {
  const { username: raw } = req.body;
  if (!raw) return res.status(400).json({ error: 'ต้องระบุ username หรือ URL' });
  try {
    const resolved = await resolveUsername(raw);
    await ensureUserLoaded(req.admin.username);
    connectLive(req.admin.username, resolved);
    res.json({ ok: true, resolved });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/live/disconnect', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  disconnectLive(req.admin.username);
  const st = getUserState(req.admin.username);
  st.commenters.clear(); broadcastCommenters(req.admin.username);
  res.json({ ok: true });
});

app.get('/api/live/status', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  res.json({ status: st.liveStatus, host: st.liveHost, error: st.liveError, commenterCount: st.commenters.size });
});

app.get('/api/live/commenters', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  res.json(Array.from(st.commenters.values()).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_COMMENTERS));
});

/* ── External chat (bookmarklet) ── */
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
app.get('/api/players', async (req, res) => {
  const u = req.query.u;
  if (!u) return res.status(400).json({ error: 'u required' });
  await ensureUserLoaded(u);
  const st = getUserState(u);
  res.json(Array.from(st.players.values()).sort((a, b) => b.win - a.win).map((p, i) => ({ ...p, rank: i + 1 })));
});

app.post('/api/player', authMiddleware, async (req, res) => {
  const { username, displayName, profilePicUrl } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const id = username.trim().replace('@', '');
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  if (st.players.has(id)) return res.status(409).json({ error: 'มีผู้เล่นนี้อยู่แล้ว' });
  let pic = profilePicUrl || '', name = displayName || id;
  if (!pic || pic.includes('ui-avatars.com') || pic.includes('unavatar')) {
    const cached = await loadFromCache(id);
    if (cached?.profilePicUrl?.startsWith('/api/avatar/')) {
      pic = cached.profilePicUrl; if (!displayName || displayName === id) name = cached.displayName || id;
    } else {
      const info = await fetchTikwmUser(id);
      if (info) { pic = info.profilePicUrl; if (!displayName || displayName === id) name = info.displayName; await saveToCache(id, { displayName: name, profilePicUrl: pic }); }
    }
  }
  if (!pic) pic = uiAvatar(id);
  st.players.set(id, { id, username: id, displayName: name, profilePicUrl: pic, win: 0, joinedAt: Date.now() });
  saveUserPlayers(req.admin.username, st.players).catch(() => {});
  broadcast(req.admin.username);
  res.json(st.players.get(id));
});

app.delete('/api/player/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  if (!st.players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  st.players.delete(id);
  saveUserPlayers(req.admin.username, st.players).catch(() => {});
  broadcast(req.admin.username);
  res.json({ ok: true });
});

app.patch('/api/player/:id/win', authMiddleware, async (req, res) => {
  const { id } = req.params;
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  if (!st.players.has(id)) return res.status(404).json({ error: 'ไม่พบผู้เล่น' });
  const p = st.players.get(id);
  p.win = Math.max(0, p.win + (req.body.delta || 0));
  saveUserPlayers(req.admin.username, st.players).catch(() => {});
  broadcast(req.admin.username);
  res.json(p);
});

app.post('/api/reset', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  st.players.clear();
  saveUserPlayers(req.admin.username, st.players).catch(() => {});
  broadcast(req.admin.username);
  res.json({ ok: true });
});

app.post('/api/reset-top1', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st     = getUserState(req.admin.username);
  const sorted = Array.from(st.players.values()).sort((a, b) => b.win - a.win);
  const top    = sorted[0];
  st.top1Threshold = top ? { id: top.id, win: top.win } : null;
  io.to(`room:${req.admin.username}`).emit('top1Reset', st.top1Threshold);
  res.json({ ok: true });
});

/* ── Watched gifter endpoints ── */
app.get('/api/watch-gifters', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  res.json(Object.fromEntries([...st.watchedGifters.entries()]));
});
app.post('/api/watch-gifter', authMiddleware, async (req, res) => {
  const uid = (req.body.uniqueId || '').trim().replace(/^@/, '');
  if (!uid) return res.status(400).json({ error: 'กรุณาระบุ username' });
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  if (!st.watchedGifters.has(uid)) {
    st.watchedGifters.set(uid, { uniqueId: uid, displayName: uid, profilePicUrl: null, profileUrl: `https://www.tiktok.com/@${uid}`, giftLog: [], totalDiamonds: 0 });
  }
  io.to(`room:${req.admin.username}`).emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
  res.json({ ok: true });
});
app.delete('/api/watch-gifter/:uid', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  st.watchedGifters.delete(req.params.uid);
  io.to(`room:${req.admin.username}`).emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
  res.json({ ok: true });
});
app.delete('/api/watch-gifter/:uid/log', authMiddleware, async (req, res) => {
  await ensureUserLoaded(req.admin.username);
  const st = getUserState(req.admin.username);
  const wg = st.watchedGifters.get(req.params.uid);
  if (wg) { wg.giftLog = []; wg.totalDiamonds = 0; }
  io.to(`room:${req.admin.username}`).emit('watchedGiftersUpdate', Object.fromEntries([...st.watchedGifters.entries()]));
  res.json({ ok: true });
});

/* ── StreamDPS routes ── */
app.post('/api/streamdps/connect', authMiddleware, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const uname = username.trim().replace(/^@/, '');
  const now   = Date.now();
  await pool.query(
    `INSERT INTO streamdps_connections (owner, username, status, connected_at, last_ping)
     VALUES ($1,$2,'connected',$3,$3)
     ON CONFLICT (owner) DO UPDATE SET username=$2, status='connected', connected_at=$3, last_ping=$3`,
    [req.admin.username, uname, now]
  );
  io.to(`room:${req.admin.username}`).emit('streamdpsStatus', { status: 'connected', username: uname, connectedAt: now });
  console.log(`[streamdps:${req.admin.username}] connected @${uname}`);
  res.json({ ok: true, username: uname, connectedAt: now });
});

app.post('/api/streamdps/disconnect', authMiddleware, async (req, res) => {
  await pool.query(
    `UPDATE streamdps_connections SET status='disconnected', last_ping=NULL WHERE owner=$1`,
    [req.admin.username]
  );
  io.to(`room:${req.admin.username}`).emit('streamdpsStatus', { status: 'disconnected', username: null });
  console.log(`[streamdps:${req.admin.username}] disconnected`);
  res.json({ ok: true });
});

app.post('/api/streamdps/ping', authMiddleware, async (req, res) => {
  const now = Date.now();
  await pool.query(
    `UPDATE streamdps_connections SET last_ping=$1 WHERE owner=$2`,
    [now, req.admin.username]
  );
  res.json({ ok: true, ts: now });
});

app.get('/api/streamdps/status', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT username, status, connected_at, last_ping FROM streamdps_connections WHERE owner=$1`,
    [req.admin.username]
  );
  if (rows.length === 0) return res.json({ status: 'idle', username: null });
  const r = rows[0];
  const stale = r.last_ping && (Date.now() - Number(r.last_ping)) > 30000;
  res.json({
    status:      stale ? 'disconnected' : r.status,
    username:    r.username,
    connectedAt: r.connected_at ? Number(r.connected_at) : null,
    lastPing:    r.last_ping    ? Number(r.last_ping)    : null,
  });
});

/* ── Serve built frontend in production ── */
const DIST_DIR = path.join(__dirname, '../dist');
if (require('fs').existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  console.log('[server] serving static files from dist/');
}

/* ── Start server after DB is ready ── */
const PORT = process.env.PORT || 3001;
(async () => {
  try {
    await initDb();
    JWT_SECRET = await getOrCreateJwtSecret();
    await migrateFromFiles();
    server.listen(PORT, '0.0.0.0', () => console.log(`[server] listening on port ${PORT}`));
  } catch (e) {
    console.error('[server] startup error:', e.message);
    process.exit(1);
  }
})();
