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
  const [showAdmin, setShowAdmin] = useState(false);

  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    const token = getToken();
    if (token) socket.emit('authenticate', { token });
    socket.on('connect', () => { if (token) socket.emit('authenticate', { token }); });
    socket.on('players', setPlayers);
    return () => { socket.off('connect'); socket.off('players'); };
  }, []);

  function notify(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const origin     = window.location.origin;
  const overlayUrl = `${origin}/overlay?u=${encodeURIComponent(username)}`;
  const newkingUrl = `${origin}/newking?u=${encodeURIComponent(username)}`;
  const top1Url    = `${origin}/top1?u=${encodeURIComponent(username)}`;

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

      <div className={styles.overlayPanel}>
        <div className={styles.overlayPanelTitle}><span className={styles.overlayPanelIcon}>🎬</span> Overlay URLs</div>
        <div className={styles.overlayRows}>
          {[
            { label: '📺 Overlay',  url: overlayUrl, color: '#25f4ee', copied,           setter: setCopied   },
            { label: '👑 New King', url: newkingUrl, color: '#ffd700', copied: copiedNK, setter: setCopiedNK },
            { label: '🥇 Top 1',   url: top1Url,    color: '#ff9933', copied: copiedT1, setter: setCopiedT1 },
          ].map(({ label, url, color, copied: c, setter }) => (
            <div className={styles.overlayRow} key={label} style={{ '--oc': color }}>
              <span className={styles.overlayLabel}>{label}</span>
              <code className={styles.urlCode} onClick={() => copyUrl(url, setter)}>{url}</code>
              <button className={styles.copyMiniBtn} onClick={() => copyUrl(url, setter)}>{c ? '✓' : 'คัดลอก'}</button>
            </div>
          ))}
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
