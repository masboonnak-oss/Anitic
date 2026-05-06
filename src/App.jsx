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

  useEffect(() => {
    socket.on('players', setPlayers);
    return () => socket.off('players');
  }, []);

  function notify(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
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
        <button className={styles.resetBtn} onClick={handleReset}>ล้างข้อมูล</button>
      </header>

      <main className={styles.main}>
        <AddPlayer onAdd={handleAdd} />

        {players.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎮</div>
            <p>พิมพ์ TikTok username เพื่อเพิ่มผู้เล่น</p>
          </div>
        ) : (
          <>
            <Podium players={top3} onWin={handleWin} />
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
