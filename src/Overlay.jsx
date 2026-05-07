import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

const CONFIGS = [
  {
    playerIdx: 1, rank: 2,
    barH: 105, barGrad: 'linear-gradient(180deg,#c8c8e0 0%,#6a6a8a 100%)',
    avatarSize: 70, frameSize: 144,
    label: 'silver',
  },
  {
    playerIdx: 0, rank: 1,
    barH: 148, barGrad: 'linear-gradient(180deg,#ffe066 0%,#f0a000 50%,#c07000 100%)',
    avatarSize: 90, frameSize: 182,
    label: 'gold',
  },
  {
    playerIdx: 2, rank: 3,
    barH: 80, barGrad: 'linear-gradient(180deg,#d49060 0%,#8a4020 100%)',
    avatarSize: 62, frameSize: 128,
    label: 'bronze',
  },
];

/* Lightning colour themes — 4 shades from light → dark */
const LC = {
  gold:   { strokes: ['#fffde0', '#ffd700', '#ffaa00', '#ff6600'] },
  silver: { strokes: ['#eef4ff', '#aaccff', '#5588ff', '#2244bb'] },
  bronze: { strokes: ['#ffeedd', '#ffcc88', '#ff7722', '#bb2200'] },
};

/* ── Orbiting lightning ring ── */
function LightningOrbit({ label, frameSize }) {
  const lc = LC[label];
  const pad = 20;
  const svgSz = frameSize + pad * 2;
  const cx = svgSz / 2;
  const cy = svgSz / 2;
  const baseR = frameSize / 2;

  /* [radiusOffset, strokeWidth, dashArray, speed, clockwise, colorIdx, opacity] */
  const rings = [
    [  5, 2.2, '24 16 6 60',  3.2,  true,  0, 1.00],
    [ 11, 1.6, '14 24 4 58',  6.0,  false, 2, 0.85],
    [  1, 1.3, '8  30',        2.1,  true,  1, 0.75],
    [ 16, 1.0, '5  42',        8.5,  false, 3, 0.50],
  ];

  return (
    <svg
      className={styles.orbitSvg}
      viewBox={`0 0 ${svgSz} ${svgSz}`}
      style={{ width: svgSz, height: svgSz, top: -pad, left: -pad }}
    >
      <defs>
        <filter id={`og-${label}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {rings.map(([rOff, sw, dash, spd, cw, ci, op], i) => (
        <circle
          key={i}
          cx={cx} cy={cy}
          r={baseR + rOff}
          fill="none"
          stroke={lc.strokes[ci]}
          strokeWidth={sw}
          strokeDasharray={dash}
          strokeLinecap="round"
          opacity={op}
          filter={`url(#og-${label})`}
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${cw ? 'orbitCW' : 'orbitCCW'} ${spd}s linear infinite`,
          }}
        />
      ))}
    </svg>
  );
}

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
    <div className={styles.avatarWrap} style={{ width: cfg.frameSize, height: cfg.frameSize }}>
      {/* Orbiting lightning — behind everything */}
      <LightningOrbit label={cfg.label} frameSize={cfg.frameSize} />

      {/* Decorative frame */}
      <img
        src="/gold-frame2.png"
        className={`${styles.frameImg} ${styles['frame_' + cfg.label]}`}
        alt=""
        draggable={false}
      />

      {/* Profile circle — front */}
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
                  {isFirst
                    ? <span className={styles.crownGold}>👑</span>
                    : <span className={cfg.rank === 2 ? styles.crownSilver : styles.crownBronze}>
                        {cfg.rank === 2 ? '🥈' : '🥉'}
                      </span>
                  }
                </div>

                <Avatar player={p} cfg={cfg} />

                <div className={`${styles.playerName} ${isFirst ? styles.nameFirst : ''}`}>
                  {p.displayName || p.username}
                </div>

                {/* WIN counter — big and clear */}
                <div className={`${styles.winsBadge} ${styles[cfg.label + 'WinsBadge']}`}>
                  <span className={`${styles.winsNum} ${styles[cfg.label + 'WinsNum']}`}>
                    {p.win}
                  </span>
                  <span className={styles.winsLabel}>WINS</span>
                </div>
              </div>

              {/* Podium bar */}
              <div
                className={`${styles.bar} ${styles[cfg.label + 'Bar']}`}
                style={{ height: cfg.barH, background: cfg.barGrad }}
              >
                <div className={styles.barShine} />
                <div className={`${styles.rankBadge} ${styles[cfg.label + 'RankBadge']}`}>
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
