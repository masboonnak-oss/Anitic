import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './LiveConnect.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function LiveConnect({ onAddPlayer }) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState({ status: 'disconnected', host: null, error: null, commenterCount: 0 });
  const [commenters, setCommenters] = useState([]);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(new Set());

  useEffect(() => {
    socket.on('liveStatus', setStatus);
    socket.on('commenters', setCommenters);
    // Fetch initial state
    fetch('/api/live/status').then(r => r.json()).then(setStatus).catch(() => {});
    fetch('/api/live/commenters').then(r => r.json()).then(setCommenters).catch(() => {});
    return () => {
      socket.off('liveStatus');
      socket.off('commenters');
    };
  }, []);

  async function connect(e) {
    e.preventDefault();
    const uname = input.trim().replace('@', '');
    if (!uname) return;
    await fetch('/api/live/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname })
    });
  }

  async function disconnect() {
    await fetch('/api/live/disconnect', { method: 'POST' });
    setAdded(new Set());
  }

  async function addPlayer(c) {
    if (added.has(c.uniqueId)) return;
    const res = await fetch('/api/player', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: c.uniqueId,
        displayName: c.nickname,
        profilePicUrl: c.profilePicUrl,
      })
    });
    if (res.ok || (await res.json()).error === 'มีผู้เล่นนี้อยู่แล้ว') {
      setAdded(prev => new Set([...prev, c.uniqueId]));
    }
    if (onAddPlayer) onAddPlayer(c.uniqueId);
  }

  const isConnected   = status.status === 'connected';
  const isConnecting  = status.status === 'connecting';
  const isError       = status.status === 'error';

  return (
    <div className={styles.wrap}>
      {/* Header bar */}
      <button className={`${styles.toggle} ${isConnected ? styles.toggleOn : ''}`}
        onClick={() => setOpen(o => !o)}>
        <span className={`${styles.dot} ${styles['dot_' + status.status]}`} />
        <span>
          {isConnected ? `🔴 LIVE: @${status.host}` :
           isConnecting ? '⏳ กำลังเชื่อมต่อ...' :
           isError ? `❌ ${status.error}` : '📡 เชื่อมต่อ TikTok Live'}
        </span>
        {commenters.length > 0 && (
          <span className={styles.badge}>{commenters.length} คน</span>
        )}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {/* Connect form */}
          {!isConnected && !isConnecting && (
            <form className={styles.form} onSubmit={connect}>
              <span className={styles.at}>@</span>
              <input className={styles.input} placeholder="username คู่ไลฟ์สด..."
                value={input} onChange={e => setInput(e.target.value)} autoComplete="off"/>
              <button className={styles.connectBtn} type="submit" disabled={!input.trim()}>
                เชื่อมต่อ
              </button>
            </form>
          )}

          {isConnecting && (
            <div className={styles.connecting}>
              <span className={styles.spinner}/> กำลังเชื่อมต่อ @{status.host}...
            </div>
          )}

          {isConnected && (
            <div className={styles.connectedBar}>
              <span className={styles.live}>🔴 LIVE @{status.host}</span>
              <span className={styles.seen}>{status.commenterCount} คนคอมเมนต์</span>
              <button className={styles.disconnectBtn} onClick={disconnect}>ตัดการเชื่อมต่อ</button>
            </div>
          )}

          {isError && (
            <div className={styles.errBox}>
              <span>⚠️ {status.error}</span>
              <button className={styles.retryBtn} onClick={() => setOpen(true)}>ลองใหม่</button>
            </div>
          )}

          {/* Commenter list */}
          {commenters.length > 0 && (
            <>
              <div className={styles.listHdr}>
                💬 ผู้คอมเมนต์ล่าสุด — กด + เพื่อเพิ่มเป็นผู้เล่น
              </div>
              <div className={styles.list}>
                {commenters.map(c => {
                  const alreadyAdded = added.has(c.uniqueId);
                  return (
                    <div key={c.uniqueId} className={`${styles.row} ${alreadyAdded ? styles.rowAdded : ''}`}>
                      <img className={styles.avatar} src={c.profilePicUrl} alt={c.nickname}
                        onError={e => { e.target.src = `https://unavatar.io/tiktok/${c.uniqueId}`; }}/>
                      <div className={styles.info}>
                        <span className={styles.nick}>{c.nickname}</span>
                        <span className={styles.uid}>@{c.uniqueId}</span>
                      </div>
                      {c.lastMsg && <span className={styles.msg}>"{c.lastMsg}"</span>}
                      <button
                        className={`${styles.addBtn} ${alreadyAdded ? styles.addedBtn : ''}`}
                        onClick={() => addPlayer(c)}
                        disabled={alreadyAdded}>
                        {alreadyAdded ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {isConnected && commenters.length === 0 && (
            <div className={styles.waiting}>
              รอผู้ชมคอมเมนต์...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
