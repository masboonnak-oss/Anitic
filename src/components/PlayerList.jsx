import React from 'react';
import styles from './PlayerList.module.css';

function Avatar({ player }) {
  return (
    <div className={styles.avatarWrap}>
      <img
        className={styles.avatarImg}
        src={player.profilePicUrl}
        alt={player.displayName}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
      <div className={styles.avatarFallback} style={{ display: 'none' }}>
        {(player.displayName || player.username)[0].toUpperCase()}
      </div>
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
