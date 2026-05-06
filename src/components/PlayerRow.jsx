import React from 'react';
import styles from './PlayerRow.module.css';

export default function PlayerRow({ rank, player, onEdit }) {
  const { uniqueId, nickname, profilePictureUrl, score, village, winRate, likeCount, commentCount } = player;

  return (
    <div className={styles.row}>
      <div className={styles.rank}>{rank}</div>
      <div className={styles.player}>
        <div className={styles.avatar}>
          {profilePictureUrl
            ? <img src={profilePictureUrl} alt={nickname} onError={e => e.target.style.display='none'} />
            : <div className={styles.fallback}>{(nickname || uniqueId)[0].toUpperCase()}</div>
          }
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{nickname || uniqueId}</div>
          <div className={styles.sub}>❤️ {likeCount} &nbsp;💬 {commentCount}</div>
        </div>
      </div>
      <div className={styles.village}>{village || <span className={styles.empty}>-</span>}</div>
      <div className={styles.winRate}>
        {winRate ? <span className={styles.winBadge}>{winRate}%</span> : <span className={styles.empty}>-</span>}
      </div>
      <div className={styles.score}>{score.toLocaleString()}</div>
      <button className={styles.editBtn} onClick={onEdit} title="แก้ไข">✏️</button>
    </div>
  );
}
