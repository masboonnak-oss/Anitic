import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

// col order: 2nd left, 1st center, 3rd right
const CONFIGS = [
  {
    playerIdx: 1, rank: 2,
    barH: 110, barGrad: 'linear-gradient(180deg,#c8c8e0 0%,#6a6a8a 100%)',
    avatarSize: 68,   // inner circle px
    frameSize: 140,   // total frame container px
    label: 'silver',
  },
  {
    playerIdx: 0, rank: 1,
    barH: 155, barGrad: 'linear-gradient(180deg,#ffe066 0%,#f0a000 50%,#c07000 100%)',
    avatarSize: 88,
    frameSize: 178,
    label: 'gold',
  },
  {
    playerIdx: 2, rank: 3,
    barH: 85, barGrad: 'linear-gradient(180deg,#d49060 0%,#8a4020 100%)',
    avatarSize: 60,
    frameSize: 124,
    label: 'bronze',
  },
];

function Sparkles() {
  return (
    <div className={styles.sparkles}>
      {[...Array(7)].map((_, i) => (
        <div key={i} className={styles.sparkle} style={{ '--i': i }} />
      ))}
    </div>
  );
}

function Avatar({ player, cfg }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className={styles.avatarWrap}
      style={{ width: cfg.frameSize, height: cfg.frameSize }}
    >
      {/* Profile circle — sits behind, exactly fills the ring opening */}
      <div
        className={styles.avatarCircle}
        style={{ width: cfg.avatarSize, height: cfg.avatarSize }}
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

      {/* Frame on top — mix-blend-mode:screen makes black pixels transparent */}
      <img
        src="/gold-frame2.png"
        className={`${styles.frameImg} ${styles['frame_' + cfg.label]}`}
        alt=""
        draggable={false}
      />
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
        {CONFIGS.map((cfg) => {
          const p = top3[cfg.playerIdx];
          if (!p) return null;
          const isFirst = cfg.rank === 1;

          return (
            <div key={p.id} className={`${styles.column} ${isFirst ? styles.colFirst : ''}`}>

              <div className={`${styles.card} ${styles[cfg.label + 'Card']}`}>
                {isFirst && <Sparkles />}

                {/* Crown / medal */}
                <div className={`${styles.crownWrap} ${isFirst ? styles.crownFirst : styles.crownSmall}`}>
                  {isFirst ? '👑' : cfg.rank === 2 ? '🥈' : '🥉'}
                </div>

                <Avatar player={p} cfg={cfg} />

                <div className={`${styles.playerName} ${isFirst ? styles.nameFirst : ''}`}>
                  {p.displayName || p.username}
                </div>

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
