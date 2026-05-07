import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Podium from './components/Podium.jsx';
import PlayerList from './components/PlayerList.jsx';
import AddPlayer from './components/AddPlayer.jsx';
import styles from './App.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function App() {
  const [players, setPlayers] = useState([]);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedNK, setCopiedNK] = useState(false);
  const [copiedT1, setCopiedT1] = useState(false);

  useEffect(() => {
    socket.on('players', setPlayers);
    return () => socket.off('players');
  }, []);

  function notify(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function copyOverlayUrl() {
    const url = `${window.location.origin}/overlay`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyNewKingUrl() {
    const url = `${window.location.origin}/newking`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedNK(true);
      setTimeout(() => setCopiedNK(false), 2000);
    });
  }

  function copyTop1Url() {
    const url = `${window.location.origin}/top1`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedT1(true);
      setTimeout(() => setCopiedT1(false), 2000);
    });
  }

  async function handleAdd({ username, displayName, profilePicUrl }) {
    const res = await fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, profilePicUrl })
    });
    const data = await res.json();
    if (res.ok) notify(`เพิ่ม ${displayName || username} แล้ว`);
    else notify(data.error || 'เพิ่มไม่ได้', 'error');
  }

  async function handleWin(id, delta) {
    await fetch(`/api/player/${encodeURIComponent(id)}/win`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
  }

  async function handleDelete(id) {
    await fetch(`/api/player/${encodeURIComponent(id)}`, { method: 'DELETE' });
    notify('ลบผู้เล่นแล้ว', 'info');
  }

  async function handleResetTop1() {
    if (!confirm('ล้าง Top 1 overlay?')) return;
    await fetch('/api/reset-top1', { method: 'POST' });
    notify('ล้าง Top 1 แล้ว', 'info');
  }

  async function handleReset() {
    if (!confirm('ล้างข้อมูลทั้งหมด?')) return;
    await fetch('/api/reset', { method: 'POST' });
    notify('ล้างข้อมูลแล้ว', 'info');
  }

  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>🏆 WIN Leaderboard</div>
        <div className={styles.headerActions}>
          <button className={styles.copyBtn} onClick={copyOverlayUrl}>
            {copied ? '✓ คัดลอกแล้ว!' : '📺 คัดลอก URL Overlay'}
          </button>
          <button className={styles.copyBtnNK} onClick={copyNewKingUrl}>
            {copiedNK ? '✓ คัดลอกแล้ว!' : '👑 New King'}
          </button>
          <button className={styles.copyBtnT1} onClick={copyTop1Url}>
            {copiedT1 ? '✓ คัดลอกแล้ว!' : '🥇 Top 1'}
          </button>
          <button className={styles.resetTop1Btn} onClick={handleResetTop1}>ล้าง Top 1</button>
          <button className={styles.resetBtn} onClick={handleReset}>ล้างข้อมูล</button>
        </div>
      </header>

      <div className={styles.overlayPanel}>
        <div className={styles.overlayPanelTitle}>
          <span className={styles.overlayPanelIcon}>🎬</span>
          Overlay URLs
        </div>
        <div className={styles.overlayRows}>
          <div className={styles.overlayRow}>
            <span className={styles.overlayLabel} style={{'--oc':'#25f4ee'}}>📺 Overlay</span>
            <code className={styles.urlCode} onClick={copyOverlayUrl}>{window.location.origin}/overlay</code>
            <button className={styles.copyMiniBtn} style={{'--oc':'#25f4ee'}} onClick={copyOverlayUrl}>
              {copied ? '✓' : 'คัดลอก'}
            </button>
          </div>
          <div className={styles.overlayRow}>
            <span className={styles.overlayLabel} style={{'--oc':'#ffd700'}}>👑 New King</span>
            <code className={styles.urlCode} onClick={copyNewKingUrl}>{window.location.origin}/newking</code>
            <button className={styles.copyMiniBtn} style={{'--oc':'#ffd700'}} onClick={copyNewKingUrl}>
              {copiedNK ? '✓' : 'คัดลอก'}
            </button>
          </div>
          <div className={styles.overlayRow}>
            <span className={styles.overlayLabel} style={{'--oc':'#ff9933'}}>🥇 Top 1</span>
            <code className={styles.urlCode} onClick={copyTop1Url}>{window.location.origin}/top1</code>
            <button className={styles.copyMiniBtn} style={{'--oc':'#ff9933'}} onClick={copyTop1Url}>
              {copiedT1 ? '✓' : 'คัดลอก'}
            </button>
          </div>
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
            {rest.length > 0 && (
              <PlayerList players={rest} onWin={handleWin} onDelete={handleDelete} />
            )}
          </>
        )}
      </main>

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
