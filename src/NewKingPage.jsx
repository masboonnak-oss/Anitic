import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

const RC_GOLD = { core:'#ffffff', hi:'#fff9c0', mid:'#ffe566', outer:'#ff8800', glow:'#ffd700', ray:'#ffe03a' };

function makeBolt(cx, cy, r, startDeg, arcDeg, jitter, color, opacity, thick) {
  const steps = Math.max(5, Math.floor(arcDeg / 4));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = ((startDeg + (arcDeg * i) / steps) * Math.PI) / 180;
    const rip = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * jitter * 2;
    const ri = r + rip;
    pts.push([cx + ri * Math.cos(angle), cy + ri * Math.sin(angle)]);
  }
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return { d, color, opacity, thick: thick || false };
}

function buildFrame(cx, cy, r) {
  const c = RC_GOLD;
  const bolts = [];
  for (let b = 0; b < 6; b++) {
    const start = Math.random() * 360;
    const arc = 25 + Math.random() * 100;
    const jit = 6 + Math.random() * 8;
    const roll = Math.random();
    const col = roll < 0.25 ? c.core : roll < 0.55 ? c.hi : roll < 0.78 ? c.mid : c.outer;
    const op = 0.6 + Math.random() * 0.4;
    bolts.push(makeBolt(cx, cy, r, start, arc, jit, col, op, roll < 0.2));
    if (Math.random() > 0.35)
      bolts.push(makeBolt(cx, cy, r + 4, start, arc * 0.7, jit * 0.4, c.outer, op * 0.3, false));
  }
  const shimmerCount = 5;
  for (let s = 0; s < shimmerCount; s++) {
    const start = (s * (360 / shimmerCount)) + Math.random() * 18;
    const arc = 18 + Math.random() * 28;
    bolts.push(makeBolt(cx, cy, r - 3, start, arc, 1.2, c.glow, 0.14 + Math.random() * 0.1, false));
  }
  return bolts;
}

function buildOuterRing(cx, cy, r) {
  const c = RC_GOLD;
  const bolts = [];
  for (let b = 0; b < 5; b++) {
    const start = Math.random() * 360;
    const arc = 15 + Math.random() * 60;
    const jit = 5 + Math.random() * 9;
    const col = Math.random() < 0.5 ? c.mid : c.outer;
    bolts.push(makeBolt(cx, cy, r, start, arc, jit, col, 0.4 + Math.random() * 0.4, false));
  }
  return bolts;
}

function LightningOrbit({ frameSize }) {
  const c = RC_GOLD;
  const r = Math.round(frameSize * 0.4375);
  const rOuter = Math.round(frameSize * 0.505);
  const pad = 28;
  const svgSz = frameSize + pad * 2;
  const cx = svgSz / 2, cy = svgSz / 2;

  const [inner, setInner] = useState(() => buildFrame(cx, cy, r));
  const [outer, setOuter] = useState(() => buildOuterRing(cx, cy, rOuter));
  const ref = useRef(null);

  useEffect(() => {
    ref.current = setInterval(() => {
      setInner(buildFrame(cx, cy, r));
      setOuter(buildOuterRing(cx, cy, rOuter));
    }, 48);
    return () => clearInterval(ref.current);
  }, []);

  return (
    <svg className={styles.orbitSvg}
      style={{ width: svgSz, height: svgSz, top: -pad, left: -pad }}
      viewBox={`0 0 ${svgSz} ${svgSz}`}>
      <defs>
        <filter id="nk-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="nk-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={c.glow} strokeWidth="10" opacity="0.12" filter="url(#nk-soft)"/>
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={c.outer} strokeWidth="6" opacity="0.08" filter="url(#nk-soft)"/>
      {inner.map((b, i) => (
        <path key={`i${i}`} d={b.d} fill="none"
          stroke={b.color} strokeWidth={b.thick ? 2.8 : 1.4}
          strokeLinecap="round" strokeLinejoin="round"
          opacity={b.opacity} filter="url(#nk-glow)"/>
      ))}
      {outer.map((b, i) => (
        <path key={`o${i}`} d={b.d} fill="none"
          stroke={b.color} strokeWidth="1.2"
          strokeLinecap="round" strokeLinejoin="round"
          opacity={b.opacity} filter="url(#nk-glow)"/>
      ))}
    </svg>
  );
}

function Confetti({ count = 50 }) {
  return (
    <div className={styles.confettiWrap} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.confettiPiece}
          style={{
            '--cx': `${Math.random() * 100}%`,
            '--cd': `${1.2 + Math.random() * 3.5}s`,
            '--cdd': `${Math.random() * 1.8}s`,
            '--cw': `${4 + Math.random() * 8}px`,
            '--cr': `${Math.random() * 360}deg`,
            '--cc': ['#ffd700','#ffe566','#ff8800','#fff3a0','#ffffff','#ffcc44'][Math.floor(Math.random()*6)],
          }}
        />
      ))}
    </div>
  );
}

function NewKingDisplay({ king, phase }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [king?.id]);

  return (
    <div className={`${styles.newKingBackdrop} ${styles['nk_' + phase]}`}>
      <Confetti count={50} />
      <div className={styles.nkRays} />
      <div className={`${styles.nkCard} ${styles['nkCard_' + phase]}`}>
        <img src="/crown-king.png" className={styles.nkCrown} alt="crown" draggable={false} />
        <div className={styles.nkTitle}>
          <span className={styles.nkTitleLine1}>✦ ราชาคนใหม่ ✦</span>
          <span className={styles.nkTitleLine2}>NEW KING</span>
        </div>
        <div className={styles.nkAvatarRing}>
          <div className={styles.nkAvatarGlow} />
          <div className={styles.nkAvatarCircle}>
            {!imgErr && king.profilePicUrl ? (
              <img src={king.profilePicUrl} alt={king.displayName}
                className={styles.nkAvatarImg} onError={() => setImgErr(true)} />
            ) : (
              <div className={styles.nkAvatarFallback}>
                {(king.displayName || king.username || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          <LightningOrbit frameSize={160} />
        </div>
        <div className={styles.nkName}>{king.displayName || king.username}</div>
        <div className={styles.nkWins}>
          <span className={styles.nkWinsNum}>{king.win}</span>
          <span className={styles.nkWinsLabel}>WINS</span>
        </div>
      </div>
    </div>
  );
}

export default function NewKingPage() {
  const [king, setKing] = useState(null);
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';

    socket.on('newKing', (data) => {
      setKing(data);
      setPhase('enter');
      setTimeout(() => setPhase('show'), 80);
      setTimeout(() => setPhase('exit'), 5800);
      setTimeout(() => setKing(null), 6600);
    });

    return () => socket.off('newKing');
  }, []);

  if (!king) return null;

  return <NewKingDisplay key={king.id + '_' + king.win} king={king} phase={phase} />;
}
