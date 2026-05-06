import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Leaderboard from './components/Leaderboard.jsx';
import ConnectPanel from './components/ConnectPanel.jsx';
import EditPlayerModal from './components/EditPlayerModal.jsx';
import AddPlayerModal from './components/AddPlayerModal.jsx';
import styles from './App.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function App() {
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState({ connected: false, username: null });
  const [editPlayer, setEditPlayer] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    socket.on('leaderboard', setPlayers);
    socket.on('status', setStatus);
    return () => {
      socket.off('leaderboard');
      socket.off('status');
    };
  }, []);

  function notify(msg, type = 'success') {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  async function handleConnect(username) {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.ok) notify(`กำลังเชื่อมต่อ @${username}...`, 'info');
    else notify(data.error || 'เชื่อมต่อไม่ได้', 'error');
  }

  async function handleDisconnect() {
    await fetch('/api/disconnect', { method: 'POST' });
    notify('ยกเลิกการเชื่อมต่อแล้ว', 'info');
  }

  async function handleReset() {
    if (!confirm('ล้างข้อมูล Leaderboard ทั้งหมด?')) return;
    await fetch('/api/reset', { method: 'POST' });
    notify('ล้างข้อมูลแล้ว', 'info');
  }

  async function handleSavePlayer(uniqueId, data) {
    const res = await fetch(`/api/player/${encodeURIComponent(uniqueId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      notify('บันทึกข้อมูลแล้ว');
      setEditPlayer(null);
    } else {
      notify('บันทึกไม่ได้', 'error');
    }
  }

  async function handleAddPlayer(data) {
    const res = await fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      notify('เพิ่มผู้เล่นแล้ว');
      setShowAdd(false);
    } else {
      notify('เพิ่มไม่ได้', 'error');
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎯</span>
            <span className={styles.logoText}>TikTok Live Leaderboard</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnOutline} onClick={() => setShowAdd(true)}>
              + เพิ่มผู้เล่น
            </button>
            <button className={styles.btnDanger} onClick={handleReset}>
              ล้างข้อมูล
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <ConnectPanel
          status={status}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
        <Leaderboard
          players={players}
          onEdit={setEditPlayer}
        />
      </main>

      {editPlayer && (
        <EditPlayerModal
          player={editPlayer}
          onSave={handleSavePlayer}
          onClose={() => setEditPlayer(null)}
        />
      )}

      {showAdd && (
        <AddPlayerModal
          onSave={handleAddPlayer}
          onClose={() => setShowAdd(false)}
        />
      )}

      {notification && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          {notification.msg}
        </div>
      )}
    </div>
  );
}
