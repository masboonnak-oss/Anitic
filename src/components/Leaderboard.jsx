import React from 'react';
import PlayerRow from './PlayerRow.jsx';
import styles from './Leaderboard.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ players, onEdit }) {
  if (players.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🏆</div>
        <p className={styles.emptyTitle}>ยังไม่มีผู้เล่น</p>
        <p className={styles.emptyDesc}>เชื่อมต่อ TikTok Live หรือเพิ่มผู้เล่นด้วยตนเอง</p>
      </div>
    );
  }

  const top3 = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className={styles.wrapper}>
      <div className={styles.podium}>
        {top3.map((p, i) => (
          <div
            key={p.uniqueId}
            className={`${styles.podiumCard} ${i === 0 ? styles.first : i === 1 ? styles.second : styles.third}`}
            onClick={() => onEdit(p)}
          >
            <div className={styles.podiumMedal}>{MEDALS[i]}</div>
            <div className={styles.podiumAvatar}>
              {p.profilePictureUrl
                ? <img src={p.profilePictureUrl} alt={p.nickname} onError={e => e.target.style.display='none'} />
                : <div className={styles.avatarFallback}>{(p.nickname || p.uniqueId)[0].toUpperCase()}</div>
              }
            </div>
            <div className={styles.podiumName}>{p.nickname || p.uniqueId}</div>
            <div className={styles.podiumScore}>{p.score.toLocaleString()} pts</div>
            {p.village && <div className={styles.podiumVillage}>🏘 {p.village}</div>}
            {p.winRate && <div className={styles.podiumWinRate}>⚔️ {p.winRate}%</div>}
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>#</span>
            <span>ผู้เล่น</span>
            <span>Village</span>
            <span>อัตราชนะ</span>
            <span>คะแนน</span>
            <span></span>
          </div>
          {rest.map((p, i) => (
            <PlayerRow
              key={p.uniqueId}
              rank={i + 4}
              player={p}
              onEdit={() => onEdit(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
