import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './BookmarkletPanel.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

export default function BookmarkletPanel({ onAddPlayer }) {
  const [commenters, setCommenters] = useState([]);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const linkRef = useRef(null);

  /* bookmarklet href — loads /bookmarklet.js from our server with origin embedded */
  const serverOrigin = window.location.origin;
  const bookmarkletHref = `javascript:(function(){window.__WIN_SERVER__='${serverOrigin}';var s=document.createElement('script');s.src='${serverOrigin}/bookmarklet.js?t='+Date.now();document.head.appendChild(s);})()`;

  useEffect(() => {
    socket.on('commenters', setCommenters);
    fetch('/api/live/commenters').then(r => r.json()).then(setCommenters).catch(() => {});
    return () => socket.off('commenters');
  }, []);

  async function addPlayer(c) {
    if (added.has(c.uniqueId)) return;
    const res = await fetch('/api/player', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: c.uniqueId, displayName: c.nickname, profilePicUrl: c.profilePicUrl })
    });
    const data = await res.json();
    if (res.ok || data.error === 'มีผู้เล่นนี้อยู่แล้ว') {
      setAdded(prev => new Set([...prev, c.uniqueId]));
      if (onAddPlayer) onAddPlayer(c.nickname || c.uniqueId);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const total = commenters.length;

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.toggle} ${open ? styles.toggleOpen : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.icon}>🔖</span>
        <span>ดักจับ Chat ด้วย Bookmarklet {total > 0 && <span className={styles.badge}>{total} คน</span>}</span>
        <span className={styles.tag}>ทำงานบน Replit ได้</span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>

          {/* ── How it works ── */}
          <div className={styles.howBox}>
            <div className={styles.howTitle}>⚡ วิธีใช้งาน (ไม่ต้องรัน local)</div>
            <ol className={styles.steps}>
              <li>ลาก <strong>ปุ่มสีทอง</strong> ด้านล่างไปวางในแถบ Bookmarks ของ browser</li>
              <li>เปิด <strong>TikTok Live</strong> ที่ต้องการในแท็บใหม่</li>
              <li>คลิก bookmark นั้นขณะอยู่หน้า TikTok Live</li>
              <li>กลับมาหน้านี้ — ชื่อและรูปผู้คอมเมนต์จะปรากฏด้านล่าง</li>
            </ol>
          </div>

          {/* ── Drag target ── */}
          <div className={styles.dragBox}>
            <a
              ref={linkRef}
              href={bookmarkletHref}
              className={styles.dragLink}
              onClick={e => e.preventDefault()}
              draggable={true}
              title="ลากไปยังแถบ Bookmarks"
            >
              🏆 WIN Leaderboard Chat
            </a>
            <button className={styles.copyBtn} onClick={copyLink}>
              {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอก'}
            </button>
          </div>
          <div className={styles.dragHint}>
            ← ลากปุ่มสีทองนี้ไปวางใน Bookmarks Bar · หรือกด "คัดลอก" แล้ว paste เป็น bookmark ใหม่
          </div>

          {/* ── Commenter list (shared with live connector) ── */}
          {total > 0 && (
            <>
              <div className={styles.listHdr}>
                💬 {total} คนที่ดักจับได้ — กด <strong>+</strong> เพื่อเพิ่มเป็นผู้เล่น
              </div>
              <div className={styles.list}>
                {commenters.map(c => {
                  const done = added.has(c.uniqueId);
                  return (
                    <div key={c.uniqueId} className={`${styles.row} ${done ? styles.rowAdded : ''}`}>
                      <img
                        className={styles.avatar}
                        src={c.profilePicUrl || `/api/img?url=${encodeURIComponent(`https://unavatar.io/tiktok/${c.uniqueId}`)}`}
                        alt={c.nickname}
                        onError={e => { e.target.src = `/api/img?url=${encodeURIComponent(`https://unavatar.io/tiktok/${c.uniqueId}`)}`; }}
                      />
                      <div className={styles.info}>
                        <span className={styles.nick}>{c.nickname}</span>
                        <span className={styles.uid}>@{c.uniqueId}</span>
                      </div>
                      {c.lastMsg && <span className={styles.msg}>"{c.lastMsg}"</span>}
                      <button
                        className={`${styles.addBtn} ${done ? styles.addedBtn : ''}`}
                        onClick={() => addPlayer(c)}
                        disabled={done}
                      >
                        {done ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {total === 0 && (
            <div className={styles.waiting}>
              ยังไม่มีข้อมูล — คลิก bookmark ขณะดู TikTok Live แล้วข้อมูลจะปรากฏที่นี่
            </div>
          )}
        </div>
      )}
    </div>
  );
}
