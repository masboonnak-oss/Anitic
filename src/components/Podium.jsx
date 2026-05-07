import React, { useState } from 'react';
import styles from './Podium.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];
const COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

function Avatar({ player, size = 72 }) {
  const [err, setErr] = useState(false);
  const src = player.profilePicUrl;
  return (
    <div className={styles.avatarWrap} style={{ width: size, height: size }}>
      {!err && src
        ? <img className={styles.avatarImg} src={src} alt={player.displayName} onError={() => setErr(true)} />
        : <div className={styles.avatarFallback}>
            {(player.displayName || player.username || '?')[0].toUpperCase()}
          </div>
      }
    </div>
  );
}

export default function Podium({ players, onWin, onDelete }) {
  if (players.length === 0) return null;

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>🏆 อันดับสูงสุด</h2>
      <div className={styles.podium}>
        {players.map((p, i) => (
          <div
            key={p.id}
            className={styles.card}
            style={{ '--medal-color': COLORS[i] }}
          >
            {onDelete && (
              <button className={styles.deleteBtn} onClick={() => onDelete(p.id)} title="ลบออกจากอันดับ">
                🗑️
              </button>
            )}
            <div className={styles.medal}>{MEDALS[i]}</div>
            <Avatar player={p} size={72} />
            <div className={styles.name}>{p.displayName || p.username}</div>
            <div className={styles.usertag}>@{p.username}</div>
            <div className={styles.winCount}>{p.win}<span>WIN</span></div>
            <div className={styles.controls}>
              <button className={`${styles.btn} ${styles.minus}`} onClick={() => onWin(p.id, -1)}>−</button>
              <button className={`${styles.btn} ${styles.plus}`}  onClick={() => onWin(p.id,  1)}>+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
