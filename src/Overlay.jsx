import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

const CONFIGS = [
  {
    playerIdx: 1, rank: 2,
    barH: 110, barGrad: 'linear-gradient(180deg,#c0c0d8 0%,#707088 100%)',
    ringGrad: 'linear-gradient(135deg,#e8e8ff,#a0a0c0,#e8e8ff)',
    glowColor: '#aaaadd',
    avatarSize: 76,
    label: 'silver',
  },
  {
    playerIdx: 0, rank: 1,
    barH: 155, barGrad: 'linear-gradient(180deg,#ffe066 0%,#f0a000 50%,#c07000 100%)',
    ringGrad: 'linear-gradient(135deg,#fff7a0,#ffd700,#ff9900,#ffd700,#fff7a0)',
    glowColor: '#ffd700',
    avatarSize: 96,
    label: 'gold',
  },
  {
    playerIdx: 2, rank: 3,
    barH: 85, barGrad: 'linear-gradient(180deg,#e8a070 0%,#a05030 100%)',
    ringGrad: 'linear-gradient(135deg,#f4c090,#cd7f32,#f4c090)',
    glowColor: '#cd7f32',
    avatarSize: 68,
    label: 'bronze',
  },
];

function Sparkles() {
  return (
    <div className={styles.sparkles}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className={styles.sparkle} style={{ '--i': i }} />
      ))}
    </div>
  );
}

function Avatar({ player, cfg }) {
  const [err, setErr] = useState(false);
  return (
    <div className={`${styles.avatarOuter} ${styles[cfg.label]}`}>
      <div className={styles.avatarInner}>
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
  if (top3.length === 0) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.stage}>
        {CONFIGS.map((cfg, colIdx) => {
          const p = top3[cfg.playerIdx];
          if (!p) return null;
          const isFirst = cfg.rank === 1;

          return (
            <div key={p.id} className={`${styles.column} ${isFirst ? styles.colFirst : ''}`}>

              {/* Player card above bar */}
              <div className={`${styles.card} ${styles[cfg.label + 'Card']}`}>
                {isFirst && <Sparkles />}

                {/* Crown */}
                <div className={`${styles.crownWrap} ${isFirst ? styles.crownFirst : styles.crownSmall}`}>
                  {isFirst ? '👑' : cfg.rank === 2 ? '🥈' : '🥉'}
                </div>

                {/* Avatar */}
                <div
                  className={styles.avatarWrap}
                  style={{ width: cfg.avatarSize + 12, height: cfg.avatarSize + 12 }}
                >
                  <Avatar player={p} cfg={cfg} />
                </div>

                {/* Name */}
                <div className={`${styles.playerName} ${isFirst ? styles.nameFirst : ''}`}>
                  {p.displayName || p.username}
                </div>

                {/* Wins */}
                <div className={`${styles.winsWrap} ${styles[cfg.label + 'Wins']}`}>
                  <span className={styles.winsNum}>{p.win}</span>
                  <span className={styles.winsText}>WINS</span>
                </div>
              </div>

              {/* Podium bar */}
              <div
                className={`${styles.bar} ${isFirst ? styles.barFirst : ''}`}
                style={{ height: cfg.barH, background: cfg.barGrad }}
              >
                <div className={styles.barShine} />
                <div className={`${styles.rankBadge} ${styles[cfg.label + 'Badge']}`}>
                  {cfg.rank}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
