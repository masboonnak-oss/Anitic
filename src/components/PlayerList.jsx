import React, { useState } from 'react';
import styles from './PlayerList.module.css';

function uiAvatar(name) {
  const initials = encodeURIComponent((name || '?').slice(0, 2).toUpperCase());
  return `https://ui-avatars.com/api/?name=${initials}&background=1a1a2e&color=ffd700&bold=true&size=128`;
}

function Avatar({ player }) {
  const [err, setErr] = useState(false);
  const src = player.profilePicUrl;
  return (
    <div className={styles.avatarWrap}>
      {!err && src
        ? <img className={styles.avatarImg} src={src} alt={player.displayName} onError={() => setErr(true)} />
        : <div className={styles.avatarFallback}>
            {(player.displayName || player.username || '?')[0].toUpperCase()}
          </div>
      }
    </div>
  );
}

export default function PlayerList({ players, onWin, onDelete }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.title}>📋 ผู้เล่นทั้งหมด</h2>
      <div className={styles.list}>
        {players.map(p => (
          <div key={p.id} className={styles.row}>
            <div className={styles.rank}>{p.rank}</div>
            <Avatar player={p} />
            <div className={styles.info}>
              <div className={styles.name}>{p.displayName || p.username}</div>
              <div className={styles.usertag}>@{p.username}</div>
            </div>
            <div className={styles.win}>
              <span className={styles.winNum}>{p.win}</span>
              <span className={styles.winLabel}>WIN</span>
            </div>
            <div className={styles.controls}>
              <button className={`${styles.btn} ${styles.minus}`} onClick={() => onWin(p.id, -1)}>−</button>
              <button className={`${styles.btn} ${styles.plus}`}  onClick={() => onWin(p.id,  1)}>+</button>
            </div>
            <button className={styles.deleteBtn} onClick={() => onDelete(p.id)} title="ลบ">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
