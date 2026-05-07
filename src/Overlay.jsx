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

/* ── Lightning colour themes per rank ── */
const LC = {
  gold: {
    strokes: ['#ffffff', '#fff9c4', '#ffd700', '#ffaa00'],
    glow: '#ffd700', shadow: '#ff7700',
  },
  silver: {
    strokes: ['#ffffff', '#d0e8ff', '#88bbff', '#4477dd'],
    glow: '#99ccff', shadow: '#2244aa',
  },
  bronze: {
    strokes: ['#ffffff', '#ffddb0', '#ff8833', '#cc3300'],
    glow: '#ff8833', shadow: '#991100',
  },
};

/* Pre-defined bolt descriptors: [angleDeg, length, zigZag, strokeIdx, delay, dur] */
const BOLT_DEFS = [
  [-90,  44,  -8, 0, 0.00, 0.85],
  [-65,  32,   6, 1, 0.18, 0.72],
  [-115, 32,  -6, 2, 0.32, 0.90],
  [-40,  24,   5, 3, 0.50, 0.78],
  [-140, 24,  -5, 1, 0.65, 0.95],
  [  0,  22,   7, 0, 0.08, 0.88],
  [180,  22,  -7, 2, 0.42, 0.80],
  [ 30,  18,   4, 3, 0.55, 1.00],
  [-210, 18,  -4, 0, 0.22, 0.70],
  [-78,  28,   5, 1, 0.38, 0.82],
  [-102, 28,  -5, 2, 0.12, 0.93],
];

function LightningRing({ label, frameSize }) {
  const lc = LC[label];
  const margin = 50;
  const svgW = frameSize + margin * 2;
  const svgH = frameSize + margin * 2;
  const cx = svgW / 2;
  const cy = svgH / 2;
  const rEdge = frameSize * 0.50; // outer radius of the decorative frame ring

  const paths = BOLT_DEFS.map(([angleDeg, len, zz, si, delay, dur]) => {
    const rad = angleDeg * Math.PI / 180;
    const perp = rad + Math.PI / 2;
    const x1 = cx + rEdge * Math.cos(rad);
    const y1 = cy + rEdge * Math.sin(rad);
    const m1x = cx + (rEdge + len * 0.35) * Math.cos(rad) + zz * Math.cos(perp);
    const m1y = cy + (rEdge + len * 0.35) * Math.sin(rad) + zz * Math.sin(perp);
    const m2x = cx + (rEdge + len * 0.70) * Math.cos(rad) - zz * 0.6 * Math.cos(perp);
    const m2y = cy + (rEdge + len * 0.70) * Math.sin(rad) - zz * 0.6 * Math.sin(perp);
    const x2 = cx + (rEdge + len) * Math.cos(rad);
    const y2 = cy + (rEdge + len) * Math.sin(rad);
    return { x1, y1, m1x, m1y, m2x, m2y, x2, y2, color: lc.strokes[si], delay, dur };
  });

  return (
    <svg
      className={styles.lightningRing}
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ width: svgW, height: svgH, top: -margin, left: -margin }}
    >
      <defs>
        <filter id={`glow-${label}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {paths.map((p, i) => (
        <polyline
          key={i}
          points={`${p.x1},${p.y1} ${p.m1x},${p.m1y} ${p.m2x},${p.m2y} ${p.x2},${p.y2}`}
          fill="none"
          stroke={p.color}
          strokeWidth={i < 3 ? 2.2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#glow-${label})`}
          className={styles.boltPath}
          style={{
            '--bolt-glow': lc.glow,
            '--bolt-shadow': lc.shadow,
            '--bolt-delay': `${p.delay}s`,
            '--bolt-dur':   `${p.dur}s`,
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
      {/* Lightning behind everything */}
      <LightningRing label={cfg.label} frameSize={cfg.frameSize} />

      {/* Frame */}
      <img
        src="/gold-frame2.png"
        className={`${styles.frameImg} ${styles['frame_' + cfg.label]}`}
        alt=""
        draggable={false}
      />

      {/* Profile circle — in front */}
      <div className={styles.avatarCircle} style={{ width: cfg.avatarSize, height: cfg.avatarSize }}>
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

                <div className={`${styles.winsWrap} ${styles[cfg.label + 'Wins']}`}>
                  <span className={styles.winsNum}>{p.win}</span>
                  <span className={styles.winsText}>WINS</span>
                </div>
              </div>

              {/* Podium bar */}
              <div
                className={`${styles.bar} ${styles[cfg.label + 'Bar']}`}
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
