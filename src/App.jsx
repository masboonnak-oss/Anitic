import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Podium from './components/Podium.jsx';
import PlayerList from './components/PlayerList.jsx';
import AddPlayer from './components/AddPlayer.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import styles from './App.module.css';
import { apiFetch, getToken } from './auth.js';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function App({ username, role, onLogout }) {
  const [players, setPlayers]   = useState([]);
  const [toast, setToast]       = useState(null);
  const [copied,   setCopied]   = useState(false);
  const [copiedNK, setCopiedNK] = useState(false);
  const [copiedT1, setCopiedT1] = useState(false);
  const [copiedTG, setCopiedTG] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  /* ── TikTok Live connect state ── */
  const [liveInput,  setLiveInput]  = useState('');
  const [liveStatus, setLiveStatus] = useState({ status: 'disconnected', host: null, error: null });

  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    const token = getToken();
    if (token) socket.emit('authenticate', { token });
    socket.on('connect', () => { if (token) socket.emit('authenticate', { token }); });
    socket.on('players',    setPlayers);
    socket.on('liveStatus', setLiveStatus);
    return () => { socket.off('connect'); socket.off('players'); socket.off('liveStatus'); };
  }, []);

  function notify(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const origin       = window.location.origin;
  const overlayUrl   = `${origin}/overlay?u=${encodeURIComponent(username)}`;
  const newkingUrl   = `${origin}/newking?u=${encodeURIComponent(username)}`;
  const top1Url      = `${origin}/top1?u=${encodeURIComponent(username)}`;
  const topgifterUrl = `${origin}/topgifter?u=${encodeURIComponent(username)}`;

  function copyUrl(url, setter) {
    navigator.clipboard.writeText(url).then(() => { setter(true); setTimeout(() => setter(false), 2000); });
  }

  async function handleAdd({ username: uname, displayName, profilePicUrl }) {
    const res  = await apiFetch('/api/player', { method: 'POST', body: JSON.stringify({ username: uname, displayName, profilePicUrl }) });
    const data = await res.json();
    if (res.ok) notify(`เพิ่ม ${displayName || uname} แล้ว`);
    else notify(data.error || 'เพิ่มไม่ได้', 'error');
  }

  async function handleWin(id, delta) {
    await apiFetch(`/api/player/${encodeURIComponent(id)}/win`, { method: 'PATCH', body: JSON.stringify({ delta }) });
  }

  async function handleDelete(id) {
    await apiFetch(`/api/player/${encodeURIComponent(id)}`, { method: 'DELETE' });
    notify('ลบผู้เล่นแล้ว', 'info');
  }

  async function handleLiveConnect(e) {
    e.preventDefault();
    const uname = liveInput.trim().replace('@', '');
    if (!uname) return;
    await apiFetch('/api/live/connect', { method: 'POST', body: JSON.stringify({ username: uname }) });
  }

  async function handleLiveDisconnect() {
    await apiFetch('/api/live/disconnect', { method: 'POST' });
  }

  async function handleTestTopGifter() {
    const res = await apiFetch('/api/test-top-gifter', { method: 'POST' });
    if (res.ok) notify('🧪 ทดสอบ overlay แล้ว — ดูที่หน้า /topgifter', 'success');
    else notify('ทดสอบไม่ได้', 'error');
  }

  async function handleResetTop1() {
    if (!confirm('ล้าง Top 1 overlay?')) return;
    await apiFetch('/api/reset-top1', { method: 'POST' });
    notify('ล้าง Top 1 แล้ว', 'info');
  }

  async function handleReset() {
    if (!confirm('ล้างข้อมูลทั้งหมด?')) return;
    await apiFetch('/api/reset', { method: 'POST' });
    notify('ล้างข้อมูลแล้ว', 'info');
  }

  const isConnected  = liveStatus.status === 'connected';
  const isConnecting = liveStatus.status === 'connecting';

  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>🏆 WIN Leaderboard</div>
        <div className={styles.headerActions}>
          <button className={styles.copyBtn}   onClick={() => copyUrl(overlayUrl, setCopied)}>  {copied   ? '✓' : '📺 Overlay'}</button>
          <button className={styles.copyBtnNK} onClick={() => copyUrl(newkingUrl, setCopiedNK)}>{copiedNK ? '✓' : '👑 New King'}</button>
          <button className={styles.copyBtnT1} onClick={() => copyUrl(top1Url,   setCopiedT1)}>{copiedT1 ? '✓' : '🥇 Top 1'}</button>
          <button className={styles.resetTop1Btn} onClick={handleResetTop1}>ล้าง Top 1</button>
          <button className={styles.resetBtn}     onClick={handleReset}>ล้างข้อมูล</button>
          <div className={styles.userBadge}>
            {isSuperAdmin && (
              <button className={styles.adminPanelBtn} onClick={() => setShowAdmin(true)} title="Super Admin Panel">
                👑
              </button>
            )}
            <span className={styles.userIcon}>{isSuperAdmin ? '⭐' : '👤'}</span>
            <span className={styles.userName} style={isSuperAdmin ? { color: '#ffd700' } : {}}>
              {username}
            </span>
            <button className={styles.logoutBtn} onClick={onLogout}>ออก</button>
          </div>
        </div>
      </header>

      {/* ── Overlay URL panel ── */}
      <div className={styles.overlayPanel}>
        <div className={styles.overlayPanelTitle}><span className={styles.overlayPanelIcon}>🎬</span> Overlay URLs</div>
        <div className={styles.overlayRows}>
          {[
            { label: '📺 Overlay',       url: overlayUrl,   color: '#25f4ee', copied,           setter: setCopied   },
            { label: '👑 New King',      url: newkingUrl,   color: '#ffd700', copied: copiedNK, setter: setCopiedNK },
            { label: '🥇 Top 1',        url: top1Url,      color: '#ff9933', copied: copiedT1, setter: setCopiedT1 },
            { label: '⭐ คนเข้าห้อง',   url: topgifterUrl, color: '#ffd700', copied: copiedTG, setter: setCopiedTG },
          ].map(({ label, url, color, copied: c, setter }) => (
            <div className={styles.overlayRow} key={label} style={{ '--oc': color }}>
              <span className={styles.overlayLabel}>{label}</span>
              <code className={styles.urlCode} onClick={() => copyUrl(url, setter)}>{url}</code>
              <button className={styles.copyMiniBtn} onClick={() => copyUrl(url, setter)}>{c ? '✓' : 'คัดลอก'}</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── HIGH LEVEL overlay connect panel ── */}
      <div className={styles.levelConnectPanel}>
        <div className={styles.levelConnectTitle}>⭐ HIGH LEVEL OVERLAY — คนเลเวล &gt; 20 เข้าห้อง</div>

        <div className={styles.levelConnectBody}>
          {/* Status dot */}
          <span className={`${styles.liveDot} ${styles['liveDot_' + liveStatus.status]}`} />

          {/* Input + buttons */}
          {!isConnected && !isConnecting ? (
            <form className={styles.levelForm} onSubmit={handleLiveConnect}>
              <span className={styles.levelAt}>@</span>
              <input
                className={styles.levelInput}
                placeholder="username คนที่กำลังไลฟ์สดอยู่"
                value={liveInput}
                onChange={e => setLiveInput(e.target.value)}
                autoComplete="off"
              />
              <button className={styles.levelConnectBtn} type="submit" disabled={!liveInput.trim()}>
                เชื่อมต่อ
              </button>
            </form>
          ) : (
            <div className={styles.levelConnectedBar}>
              {isConnecting
                ? <span className={styles.levelConnectingText}>⏳ กำลังเชื่อมต่อ @{liveStatus.host}...</span>
                : <span className={styles.levelLiveText}>🔴 LIVE: @{liveStatus.host}</span>
              }
              <button className={styles.levelDisconnectBtn} onClick={handleLiveDisconnect}>
                ยกเลิก
              </button>
            </div>
          )}

          {/* Error */}
          {liveStatus.status === 'error' && liveStatus.error && (
            <div className={styles.levelErrorBox}>
              <div className={styles.levelErrorMsg}>⚠️ {liveStatus.error}</div>
              {(liveStatus.error.includes('IP') || liveStatus.error.includes('Sign API') || liveStatus.error.includes('Euler')) && (
                <div className={styles.levelErrorHint}>
                  TikTok บล็อค cloud server IP — ต้องใช้ <strong>Euler Stream Sign API Key</strong>
                  <br/>① สมัครที่ <a href="https://www.eulerstream.com/" target="_blank" rel="noreferrer" className={styles.levelErrorLink}>eulerstream.com</a> → คัดลอก API Key
                  <br/>② ตั้ง secret <code>TIKTOK_SIGN_API_KEY</code> ใน Replit → Secrets
                  <br/>หรือรันแอปบนเครื่องตัวเอง (localhost) ก็ไม่ต้องใช้ key
                </div>
              )}
            </div>
          )}

          {/* Test button */}
          <button className={styles.levelTestBtn} onClick={handleTestTopGifter}>
            🧪 เทสต์ Overlay
          </button>
        </div>
      </div>

      <main className={styles.main}>
        <AddPlayer onAdd={handleAdd} />
        {players.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎮</div>
            <p>พิมพ์ TikTok username เพื่อเพิ่มผู้เล่น</p>
          </div>
        ) : (
          <>
            <Podium players={top3} onWin={handleWin} onDelete={handleDelete} />
            {rest.length > 0 && <PlayerList players={rest} onWin={handleWin} onDelete={handleDelete} />}
          </>
        )}
      </main>

      {toast && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.msg}</div>}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
