import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './ChatCapture.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function ChatCapture({ onAddPlayer }) {
  const [username, setUsername]     = useState('');
  const [status, setStatus]         = useState('idle');
  // idle | connecting | connected | offline | blocked | error
  const [errorMsg, setErrorMsg]     = useState('');
  const [commenters, setCommenters] = useState([]);
  const [added, setAdded]           = useState(new Set());
  const [fallback, setFallback]     = useState(false);
  const [fbCopied, setFbCopied]     = useState(false);
  const activeUser = useRef('');

  /* ── Socket listeners ── */
  useEffect(() => {
    socket.on('liveStatus', (d) => {
      if (d.host !== activeUser.current) return;
      if (d.status === 'connected') {
        setStatus('connected');
        setErrorMsg('');
      } else if (d.status === 'error') {
        const msg = d.error || '';
        const isOffline = msg.includes('ไม่ได้ไลฟ์') || msg.includes('offline') ||
          msg.includes('UserOffline') || msg.includes('OFFLINE') ||
          msg.includes('not live') || msg.includes('Room ID');
        const isBlocked = msg.includes('บล็อค') || msg.includes('block') ||
          msg.includes('cloud') || msg.includes('Cloud') || msg.includes('IP');
        setStatus(isOffline ? 'offline' : isBlocked ? 'blocked' : 'error');
        setErrorMsg(msg);
      } else if (d.status === 'disconnected' && status === 'connected') {
        setStatus('idle');
      }
    });

    socket.on('chatCapture', (data) => {
      setCommenters(prev => {
        if (prev.find(c => c.uniqueId === data.uniqueId)) return prev;
        return [data, ...prev].slice(0, 40);
      });
      if (status !== 'connected') setStatus('connected');
    });

    return () => {
      socket.off('liveStatus');
      socket.off('chatCapture');
    };
  }, [status]);

  async function handleStart(e) {
    e.preventDefault();
    const uname = username.trim().replace('@', '');
    if (!uname) return;
    activeUser.current = uname;
    setStatus('connecting');
    setErrorMsg('');
    setCommenters([]);
    setFallback(false);
    setAdded(new Set());
    await fetch('/api/live/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname }),
    });
  }

  async function handleStop() {
    await fetch('/api/live/disconnect', { method: 'POST' });
    activeUser.current = '';
    setStatus('idle');
    setErrorMsg('');
    setCommenters([]);
  }

  function addCommenter(c) {
    if (added.has(c.uniqueId)) return;
    setAdded(prev => new Set([...prev, c.uniqueId]));
    onAddPlayer && onAddPlayer(c);
  }

  /* ── Fallback browser script ── */
  const buildScript = () => {
    const uname = activeUser.current || username.trim().replace('@', '');
    const origin = window.location.origin;
    return `javascript:(function(){window.__WIN_SERVER__='${origin}';window.__WIN_USER__='${uname}';var s=document.createElement('script');s.src='${origin}/bookmarklet.js?t='+Date.now();document.head.appendChild(s);})()`;
  };

  function openFallback() {
    const uname = activeUser.current || username.trim().replace('@', '');
    navigator.clipboard.writeText(buildScript()).catch(() => {});
    window.open(`https://www.tiktok.com/@${uname}/live`, '_blank');
    setFbCopied(true);
    setFallback(true);
  }

  const uname = username.trim().replace('@', '');
  const isRunning = status === 'connecting' || status === 'connected';

  const statusLabel = {
    idle:       null,
    connecting: { text: 'กำลังเชื่อมต่อ...', cls: styles.statusConnecting },
    connected:  { text: '● เชื่อมต่อแล้ว', cls: styles.statusConnected },
    offline:    { text: '✕ ผู้ใช้ไม่ได้ไลฟ์อยู่', cls: styles.statusError },
    blocked:    { text: '✕ Cloud ถูก TikTok บล็อค', cls: styles.statusError },
    error:      { text: '✕ เชื่อมต่อไม่ได้', cls: styles.statusError },
  }[status];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.icon}>📡</span>
        <span className={styles.title}>ดักจับ Chat อัตโนมัติ</span>
        {status === 'connected' && <span className={styles.liveBadge}>LIVE</span>}
      </div>

      <form className={styles.form} onSubmit={handleStart}>
        <div className={styles.row}>
          <span className={styles.at}>@</span>
          <input
            className={styles.input}
            placeholder="username คนที่ไลฟ์..."
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="off"
            disabled={isRunning}
          />
          {!isRunning ? (
            <button className={styles.btn} type="submit" disabled={!uname}>
              เริ่ม
            </button>
          ) : (
            <button className={`${styles.btn} ${styles.btnStop}`} type="button"
              onClick={handleStop}>
              หยุด
            </button>
          )}
        </div>
      </form>

      {/* Status bar */}
      {statusLabel && (
        <div className={`${styles.statusBar} ${statusLabel.cls}`}>
          {statusLabel.text}
        </div>
      )}

      {/* Connecting spinner */}
      {status === 'connecting' && (
        <div className={styles.connecting}>
          <span className={styles.spinner} />
          <span>กำลังค้นหาไลฟ์ของ @{activeUser.current}...</span>
        </div>
      )}

      {/* Blocked fallback option */}
      {(status === 'blocked' || status === 'error') && (
        <div className={styles.fallbackBox}>
          <p className={styles.fallbackNote}>
            เซิร์ฟเวอร์ cloud เข้า TikTok ไม่ได้ — ใช้วิธีสำรอง:
          </p>
          {!fallback ? (
            <button className={styles.openTikBtn} onClick={openFallback}>
              🔗 เปิด TikTok Live + เชื่อมต่อ
            </button>
          ) : (
            <div className={styles.fbSteps}>
              <div className={styles.fbStep}>
                <span className={styles.stepNum}>1</span>
                แท็บ TikTok เปิดแล้ว
              </div>
              <div className={styles.fbStep}>
                <span className={styles.stepNum}>2</span>
                คลิก address bar แล้ว Paste
                <kbd>Ctrl+L</kbd><kbd>Ctrl+V</kbd><kbd>Enter</kbd>
              </div>
              <div className={styles.fbOk}>✓ Script คัดลอกแล้ว พร้อม Paste</div>
            </div>
          )}
        </div>
      )}

      {/* Connected & waiting */}
      {status === 'connected' && commenters.length === 0 && (
        <p className={styles.hint}>เชื่อมต่อแล้ว รอคอมเมนต์...</p>
      )}

      {/* Commenter list */}
      {commenters.length > 0 && (
        <div className={styles.list}>
          {commenters.map(c => (
            <div key={c.uniqueId} className={styles.commenter}>
              {c.profilePicUrl ? (
                <img className={styles.avatar} src={c.profilePicUrl} alt=""
                  onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div className={styles.avatarFallback}>
                  {(c.displayName || c.uniqueId)[0].toUpperCase()}
                </div>
              )}
              <div className={styles.info}>
                <div className={styles.name}>{c.displayName || c.uniqueId}</div>
                <div className={styles.uid}>@{c.uniqueId}</div>
              </div>
              <button
                className={`${styles.addBtn} ${added.has(c.uniqueId) ? styles.addedBtn : ''}`}
                onClick={() => addCommenter(c)}
                disabled={added.has(c.uniqueId)}
              >
                {added.has(c.uniqueId) ? '✓' : '+'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
