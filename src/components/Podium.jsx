import React from 'react';
import styles from './Podium.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];
const COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

export default function Podium({ players, onWin }) {
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
            <div className={styles.medal}>{MEDALS[i]}</div>
            <div className={styles.avatar}>
              {p.username[0].toUpperCase()}
            </div>
            <div className={styles.name}>{p.username}</div>
            <div className={styles.winCount}>{p.win} <span>WIN</span></div>
            <div className={styles.controls}>
              <button
                className={`${styles.btn} ${styles.minus}`}
                onClick={() => onWin(p.id, -1)}
              >−</button>
              <button
                className={`${styles.btn} ${styles.plus}`}
                onClick={() => onWin(p.id, 1)}
              >+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
