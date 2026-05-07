import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './ChatCapture.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function ChatCapture({ onAddPlayer }) {
  const [username, setUsername] = useState('');
  const [step, setStep] = useState('idle'); // idle | ready | capturing
  const [copied, setCopied] = useState(false);
  const [commenters, setCommenters] = useState([]);
  const [added, setAdded] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    socket.on('chatCapture', (data) => {
      setCommenters(prev => {
        const exists = prev.find(c => c.uniqueId === data.uniqueId);
        if (exists) return prev;
        return [data, ...prev].slice(0, 30);
      });
      setStep('capturing');
    });
    return () => socket.off('chatCapture');
  }, []);

  const buildScript = (uname) => {
    const origin = window.location.origin;
    return `javascript:(function(){window.__WIN_SERVER__='${origin}';window.__WIN_USER__='${uname}';var s=document.createElement('script');s.src='${origin}/bookmarklet.js?t='+Date.now();document.head.appendChild(s);})()`;
  };

  function handleStart(e) {
    e.preventDefault();
    const uname = username.trim().replace('@', '');
    if (!uname) return;

    const script = buildScript(uname);
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 5000);
    }).catch(() => {});

    window.open(`https://www.tiktok.com/@${uname}/live`, '_blank');
    setStep('ready');
  }

  function addCommenter(c) {
    if (added.has(c.uniqueId)) return;
    setAdded(prev => new Set([...prev, c.uniqueId]));
    onAddPlayer && onAddPlayer(c);
  }

  const uname = username.trim().replace('@', '');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.icon}>📡</span>
        <span className={styles.title}>ดักจับ Chat อัตโนมัติ</span>
        {step === 'capturing' && <span className={styles.liveBadge}>LIVE</span>}
      </div>

      <form className={styles.form} onSubmit={handleStart}>
        <div className={styles.row}>
          <span className={styles.at}>@</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="username คนที่ไลฟ์..."
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="off"
          />
          <button className={styles.btn} type="submit" disabled={!uname}>
            เริ่ม
          </button>
        </div>
      </form>

      {step === 'idle' && (
        <p className={styles.hint}>กรอก username คนไลฟ์ แล้วกด เริ่ม</p>
      )}

      {step === 'ready' && (
        <div className={styles.instructions}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            TikTok Live เปิดแล้วในแท็บใหม่
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            คลิกช่อง address bar ของแท็บนั้น
            <kbd>Ctrl+L</kbd>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            Paste แล้วกด Enter
            <kbd>Ctrl+V</kbd> <kbd>Enter</kbd>
          </div>
          <div className={`${styles.copyStatus} ${copied ? styles.ok : styles.dim}`}>
            {copied ? '✓ สคริปต์คัดลอกแล้ว! พร้อม Paste' : 'คัดลอก script อีกครั้ง'}
          </div>
          {!copied && (
            <button className={styles.recopyBtn} onClick={() => {
              navigator.clipboard.writeText(buildScript(uname)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 5000);
              });
            }}>
              📋 คัดลอก Script
            </button>
          )}
          <p className={styles.waiting}>รอรับข้อมูล chat...</p>
        </div>
      )}

      {step === 'capturing' && commenters.length === 0 && (
        <p className={styles.hint}>เชื่อมต่อแล้ว กำลังรอคอมเมนต์...</p>
      )}

      {commenters.length > 0 && (
        <div className={styles.list}>
          {commenters.map(c => (
            <div key={c.uniqueId} className={styles.commenter}>
              {c.profilePicUrl ? (
                <img className={styles.avatar} src={c.profilePicUrl} alt=""
                  onError={e => e.target.style.display='none'} />
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
