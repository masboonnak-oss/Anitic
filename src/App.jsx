import React, { useState, useEffect, useRef } from 'react';
import socket from './socket.js';
import Podium from './components/Podium.jsx';
import PlayerList from './components/PlayerList.jsx';
import AddPlayer from './components/AddPlayer.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import LiveConnect from './components/LiveConnect.jsx';
import ChatCapture from './components/ChatCapture.jsx';
import StreamDPSPanel from './components/StreamDPSPanel.jsx';
import styles from './App.module.css';
import { apiFetch, getToken } from './auth.js';

export default function App({ username, role, onLogout }) {
  const [players,   setPlayers]   = useState([]);
  const [toast,     setToast]     = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [copiedNK,  setCopiedNK]  = useState(false);
  const [copiedT1,  setCopiedT1]  = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const menuRef = useRef(null);

  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    function authenticate() {
      const token = getToken();
      if (token) socket.emit('authenticate', { token });
    }
    authenticate();
    socket.on('connect',  authenticate);
    socket.on('players',  setPlayers);
    return () => {
      socket.off('connect',  authenticate);
      socket.off('players',  setPlayers);
    };
  }, []);

  useEffect(() => {
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  function notify(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const origin     = window.location.origin;
  const overlayUrl = `${origin}/overlay?u=${encodeURIComponent(username)}`;
  const newkingUrl = `${origin}/newking?u=${encodeURIComponent(username)}`;
  const top1Url    = `${origin}/top1?u=${encodeURIComponent(username)}`;

  function copyUrl(url, setter) {
    navigator.clipboard.writeText(url).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  async function handleAdd({ username: uname, displayName, profilePicUrl }) {
    const res  = await apiFetch('/api/player', { method: 'POST', body: JSON.stringify({ username: uname, displayName, profilePicUrl }) });
    const data = await res.json();
    if (res.ok) notify(`เพิ่ม ${displayName || uname} แล้ว`);
    else notify(data.error || 'เพิ่มไม่ได้', 'error');
  }

  async function handleAddFromCapture(player) {
    const res  = await apiFetch('/api/player', {
      method: 'POST',
      body: JSON.stringify({ username: player.uniqueId || player.username, displayName: player.displayName || player.nickname, profilePicUrl: player.profilePicUrl }),
    });
    const data = await res.json();
    if (res.ok) notify(`เพิ่ม ${player.displayName || player.uniqueId} แล้ว`);
    else if (data.error !== 'มีผู้เล่นนี้อยู่แล้ว') notify(data.error || 'เพิ่มไม่ได้', 'error');
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
    setMenuOpen(false);
  }

  async function handleReset() {
    if (!confirm('ล้างข้อมูลทั้งหมด?')) return;
    await apiFetch('/api/reset', { method: 'POST' });
    notify('ล้างข้อมูลแล้ว', 'info');
    setMenuOpen(false);
  }

  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className={styles.app}>

      <header className={styles.header} ref={menuRef}>
        <div className={styles.logo}>
          <span className={styles.logoTrophy}>🏆</span>
          <span className={styles.logoText}>WIN Leaderboard</span>
          <span className={styles.logoSpark}>✨</span>
        </div>

        <button
          className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        <div className={`${styles.headerRight} ${menuOpen ? styles.headerRightOpen : ''}`}>
          <div className={styles.btnGroup}>
            <span className={styles.btnGroupLabel}>🔗 Copy URL</span>
            <div className={styles.btnGroupRow}>
              <button className={`${styles.hBtn} ${styles.hBtnCyan}`} onClick={() => copyUrl(overlayUrl, setCopied)}>
                {copied   ? '✓ คัดลอก' : '📺 Overlay'}
              </button>
              <button className={`${styles.hBtn} ${styles.hBtnGold}`} onClick={() => copyUrl(newkingUrl, setCopiedNK)}>
                {copiedNK ? '✓ คัดลอก' : '👑 New King'}
              </button>
              <button className={`${styles.hBtn} ${styles.hBtnOrange}`} onClick={() => copyUrl(top1Url, setCopiedT1)}>
                {copiedT1 ? '✓ คัดลอก' : '🥇 Top 1'}
              </button>
            </div>
          </div>

          <div className={styles.groupDivider} />

          <div className={styles.btnGroup}>
            <span className={styles.btnGroupLabel}>⚙️ จัดการ</span>
            <div className={styles.btnGroupRow}>
              <button className={`${styles.hBtn} ${styles.hBtnAmber}`} onClick={handleResetTop1}>
                🗑 ล้าง Top 1
              </button>
              <button className={`${styles.hBtn} ${styles.hBtnRed}`} onClick={handleReset}>
                ⚠️ ล้างข้อมูล
              </button>
            </div>
          </div>

          <div className={styles.groupDivider} />

          <div className={styles.btnGroup}>
            <span className={styles.btnGroupLabel}>👤 บัญชี</span>
            <div className={styles.btnGroupRow}>
              {isSuperAdmin && (
                <button className={styles.adminPanelBtn}
                  onClick={() => { setShowAdmin(true); setMenuOpen(false); }}
                  title="Super Admin Panel">
                  👑
                </button>
              )}
              <span className={styles.userNameBadge} style={isSuperAdmin ? { color: '#ffd700' } : {}}>
                {isSuperAdmin ? '⭐' : '👤'} {username}
              </span>
              <button className={`${styles.hBtn} ${styles.hBtnLogout}`}
                onClick={() => { onLogout(); setMenuOpen(false); }}>
                ออก
              </button>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />}

      <div className={styles.brandBar}>
        <span className={styles.brandDeco}>🎵</span>
        <span className={styles.brandDeco}>✨</span>
        <div className={styles.brandText}>
          <span className={styles.brandBy}>By TikTok</span>
          <span className={styles.brandHandle}>@Babynoryy</span>
        </div>
        <span className={styles.brandDeco}>💖</span>
        <span className={styles.brandDeco}>🎀</span>
      </div>

      <main className={styles.main}>

        <StreamDPSPanel />
        <LiveConnect onAddPlayer={handleAddFromCapture} />
        <ChatCapture onAddPlayer={handleAddFromCapture} />

        <AddPlayer onAdd={handleAdd} />

        {players.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎮</div>
            <p>🌟 พิมพ์ TikTok username เพื่อเพิ่มผู้เล่น 🌟</p>
            <p className={styles.emptyHint}>💫 กดปุ่ม + เพิ่ม เพื่อเริ่มต้น 💫</p>
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

      <div className={styles.ticker}>
        <div className={styles.tickerTrack}>
          {[...Array(4)].map((_, i) => (
            <span key={i} className={styles.tickerMsg}>
              ✨ สนใจระบบ&nbsp;<span className={styles.tickerHighlight}>Win Leaderboard</span>&nbsp;ติดต่อสอบถามเข้ามาได้เลยค่ะ &nbsp;🎵&nbsp; TikTok&nbsp;<span className={styles.tickerHandle}>@babynoryy</span>&nbsp;&nbsp;💖&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
