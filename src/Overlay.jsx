import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

const CONFIGS = [
  { playerIdx: 1, rank: 2, barH: 105, barGrad: 'linear-gradient(180deg,#c8c8e0 0%,#6a6a8a 100%)', avatarSize: 70, frameSize: 144, label: 'silver' },
  { playerIdx: 0, rank: 1, barH: 148, barGrad: 'linear-gradient(180deg,#ffe066 0%,#f0a000 50%,#c07000 100%)', avatarSize: 90, frameSize: 182, label: 'gold' },
  { playerIdx: 2, rank: 3, barH: 80, barGrad: 'linear-gradient(180deg,#d49060 0%,#8a4020 100%)', avatarSize: 62, frameSize: 128, label: 'bronze' },
];

const RANK_COLORS = {
  gold:   { core: '#ffffff', mid: '#ffe566', outer: '#ff8800', glow: '#ffd700' },
  silver: { core: '#ffffff', mid: '#c8e8ff', outer: '#2255ee', glow: '#66aaff' },
  bronze: { core: '#ffffff', mid: '#ffcc88', outer: '#cc2200', glow: '#ff6600' },
};

/* ─── Real electric lightning ─── */
function makeBolt(cx, cy, r, startDeg, arcDeg, jitter, color, opacity) {
  const steps = Math.max(4, Math.floor(arcDeg / 5));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = ((startDeg + (arcDeg * i) / steps) * Math.PI) / 180;
    const ripple = (Math.random() - 0.5) * jitter * 2;
    const ri = r + ripple;
    pts.push([cx + ri * Math.cos(angle), cy + ri * Math.sin(angle)]);
  }
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
  return { d, color, opacity };
}

function generateBolts(cx, cy, r, label) {
  const c = RANK_COLORS[label];
  const bolts = [];
  const numBolts = 2 + Math.floor(Math.random() * 3); // 2–4 bolts

  for (let b = 0; b < numBolts; b++) {
    const start = Math.random() * 360;
    const arc = 20 + Math.random() * 80;
    const jitter = 4 + Math.random() * 6;
    const roll = Math.random();
    const color = roll < 0.3 ? c.core : roll < 0.65 ? c.mid : c.outer;
    const opacity = 0.55 + Math.random() * 0.45;
    bolts.push(makeBolt(cx, cy, r, start, arc, jitter, color, opacity));

    // thin glow echo slightly bigger radius
    if (Math.random() > 0.4) {
      bolts.push(makeBolt(cx, cy, r + 3, start, arc * 0.8, jitter * 0.5, c.outer, opacity * 0.35));
    }
  }

  // always-on faint base ring segments
  for (let s = 0; s < 3; s++) {
    const start = s * 120 + Math.random() * 20;
    const arc = 25 + Math.random() * 30;
    bolts.push(makeBolt(cx, cy, r - 2, start, arc, 1.5, c.glow, 0.18 + Math.random() * 0.12));
  }

  return bolts;
}

function LightningOrbit({ label, frameSize }) {
  const c = RANK_COLORS[label];
  const pad = 28;
  const svgSz = frameSize + pad * 2;
  const cx = svgSz / 2;
  const cy = svgSz / 2;
  const r = frameSize / 2 + 2;

  const [bolts, setBolts] = useState(() => generateBolts(cx, cy, r, label));
  const intervalRef = useRef(null);

  useEffect(() => {
    // Flicker: fast base tick, with occasional bright flash
    let tick = 0;
    intervalRef.current = setInterval(() => {
      tick++;
      setBolts(generateBolts(cx, cy, r, label));
    }, 55 + Math.random() * 30); // ~16–24fps flicker
    return () => clearInterval(intervalRef.current);
  }, []);

  const filterId = `lg-${label}`;

  return (
    <svg
      className={styles.orbitSvg}
      style={{ width: svgSz, height: svgSz, top: -pad, left: -pad }}
      viewBox={`0 0 ${svgSz} ${svgSz}`}
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* soft ambient ring always underneath */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={c.glow} strokeWidth="6" opacity="0.08"
        filter={`url(#${filterId})`} />

      {/* electric bolts */}
      {bolts.map((bolt, i) => (
        <path key={i} d={bolt.d} fill="none"
          stroke={bolt.color}
          strokeWidth={i % 3 === 0 ? 2.2 : 1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={bolt.opacity}
          filter={`url(#${filterId})`}
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
      <LightningOrbit label={cfg.label} frameSize={cfg.frameSize} />
      <img
        src="/gold-frame2.png"
        className={`${styles.frameImg} ${styles['frame_' + cfg.label]}`}
        alt="" draggable={false}
      />
      <div className={styles.avatarCircle} style={{ width: cfg.avatarSize, height: cfg.avatarSize }}>
        {!err && player.profilePicUrl ? (
          <img src={player.profilePicUrl} alt={player.displayName}
            className={styles.avatarImg} onError={() => setErr(true)} />
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

                <div className={`${styles.crownWrap} ${isFirst ? styles.crownFirst : styles.crownSmall}`}>
                  {isFirst ? (
                    <img src="/crown-king.png" className={styles.crownKing} alt="crown" draggable={false} />
                  ) : (
                    <span className={cfg.rank === 2 ? styles.crownSilver : styles.crownBronze}>
                      {cfg.rank === 2 ? '🥈' : '🥉'}
                    </span>
                  )}
                </div>

                <Avatar player={p} cfg={cfg} />

                <div className={`${styles.playerName} ${isFirst ? styles.nameFirst : ''}`}>
                  {p.displayName || p.username}
                </div>

                <div className={`${styles.winsBadge} ${styles[cfg.label + 'WinsBadge']}`}>
                  <span className={`${styles.winsNum} ${styles[cfg.label + 'WinsNum']}`}>{p.win}</span>
                  <span className={styles.winsLabel}>WINS</span>
                </div>
              </div>

              <div className={`${styles.bar} ${styles[cfg.label + 'Bar']}`}
                style={{ height: cfg.barH, background: cfg.barGrad }}>
                <div className={styles.barShine} />
                <div className={`${styles.rankBadge} ${styles[cfg.label + 'RankBadge']}`}>{cfg.rank}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
