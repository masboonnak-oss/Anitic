import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

const ORDER = [1, 0, 2]; // display order: 2nd, 1st, 3rd
const BAR_HEIGHTS = [120, 160, 100]; // 2nd, 1st, 3rd
const BAR_COLORS = [
  'linear-gradient(180deg, #b8b8c8 0%, #7a7a8a 100%)',
  'linear-gradient(180deg, #ffd700 0%, #e6820a 100%)',
  'linear-gradient(180deg, #e08050 0%, #b05020 100%)',
];

function Avatar({ player, size, isFirst }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className={styles.avatarRing}
      style={{
        width: size,
        height: size,
        borderColor: isFirst ? '#ffd700' : '#fff',
        boxShadow: isFirst ? '0 0 18px #ffd70088' : '0 0 8px #ffffff44',
      }}
    >
      {!err && player.profilePicUrl ? (
        <img
          src={player.profilePicUrl}
          alt={player.displayName}
          className={styles.avatarImg}
          onError={() => setErr(true)}
        />
      ) : (
        <div className={styles.avatarFallback}>
          {(player.displayName || player.username)[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

export default function Overlay() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    socket.on('players', setPlayers);
    return () => socket.off('players');
  }, []);

  const top3 = players.slice(0, 3);
  if (top3.length === 0) return <div className={styles.waiting}>🏆 รอผู้เล่น...</div>;

  return (
    <div className={styles.overlay}>
      <div className={styles.stage}>
        {ORDER.map((playerIdx, colIdx) => {
          const p = top3[playerIdx];
          if (!p) return null;
          const isFirst = playerIdx === 0;
          const avatarSize = isFirst ? 90 : 72;

          return (
            <div key={p.id} className={styles.column}>
              <div className={styles.playerTop}>
                {isFirst && <div className={styles.crown}>👑</div>}
                <Avatar player={p} size={avatarSize} isFirst={isFirst} />
                <div className={styles.playerName}>{p.displayName || p.username}</div>
                <div className={styles.winsLabel}>{p.win} Wins</div>
              </div>
              <div
                className={styles.bar}
                style={{
                  height: BAR_HEIGHTS[colIdx],
                  background: BAR_COLORS[colIdx],
                }}
              >
                <div className={styles.rankNum}>{playerIdx + 1}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
