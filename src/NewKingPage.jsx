import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import s from './NewKing.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });
const ROOM_USER = new URLSearchParams(window.location.search).get('u') || '';
function joinRoom() { if (ROOM_USER) socket.emit('joinRoom', { username: ROOM_USER }); }
socket.on('connect', joinRoom);
joinRoom();

/* ─── Lightning bolt generator ─── */
function makeBolt(cx, cy, r, startDeg, arcDeg, jitter, color, opacity, thick) {
  const steps = Math.max(5, Math.floor(arcDeg / 4));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = ((startDeg + (arcDeg * i) / steps) * Math.PI) / 180;
    const rip = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * jitter * 2;
    pts.push([cx + (r + rip) * Math.cos(angle), cy + (r + rip) * Math.sin(angle)]);
  }
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return { d, color, opacity, thick };
}

function buildLightning(cx, cy, r) {
  const COLS = ['#ffffff','#fff9c0','#ffe566','#ffd700','#ff8800'];
  const bolts = [];
  for (let b = 0; b < 9; b++) {
    const start = Math.random() * 360;
    const arc   = 20 + Math.random() * 110;
    const jit   = 7 + Math.random() * 10;
    const col   = COLS[Math.floor(Math.random() * COLS.length)];
    const op    = 0.55 + Math.random() * 0.45;
    const thick = Math.random() < 0.25;
    bolts.push(makeBolt(cx, cy, r,     start, arc,       jit,     col,     op,      thick));
    bolts.push(makeBolt(cx, cy, r + 5, start, arc * 0.6, jit * 0.4, '#ff8800', op * 0.28, false));
  }
  for (let s2 = 0; s2 < 6; s2++) {
    const start = (s2 * 60) + Math.random() * 15;
    bolts.push(makeBolt(cx, cy, r - 4, start, 16 + Math.random() * 24, 1.2, '#ffd700', 0.12 + Math.random() * 0.1, false));
  }
  return bolts;
}

function LightningRing({ size }) {
  const pad = 36, sz = size + pad * 2, cx = sz / 2, cy = sz / 2;
  const r1 = size * 0.48, r2 = size * 0.56;
  const [b1, setB1] = useState(() => buildLightning(cx, cy, r1));
  const [b2, setB2] = useState(() => buildLightning(cx, cy, r2));
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  useEffect(() => {
    const INTERVAL = 1000 / 30; // refresh lightning at 30Hz — noise doesn't need 60
    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - lastRef.current < INTERVAL) return;
      lastRef.current = now;
      setB1(buildLightning(cx, cy, r1));
      setB2(buildLightning(cx, cy, r2));
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <svg className={s.lightning}
      style={{ width: sz, height: sz, top: -pad, left: -pad }}
      viewBox={`0 0 ${sz} ${sz}`}>
      <defs>
        <filter id="lg" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="lgs" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="9"/>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r1} fill="none" stroke="#ffd700" strokeWidth="12" opacity="0.10" filter="url(#lgs)"/>
      <circle cx={cx} cy={cy} r={r2} fill="none" stroke="#ff8800" strokeWidth="8"  opacity="0.07" filter="url(#lgs)"/>
      {b1.map((b, i) => <path key={`a${i}`} d={b.d} fill="none" stroke={b.color}
        strokeWidth={b.thick ? 3.2 : 1.5} strokeLinecap="round" opacity={b.opacity} filter="url(#lg)"/>)}
      {b2.map((b, i) => <path key={`b${i}`} d={b.d} fill="none" stroke={b.color}
        strokeWidth={1.0} strokeLinecap="round" opacity={b.opacity * 0.7} filter="url(#lg)"/>)}
    </svg>
  );
}

/* ─── Confetti ─── */
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 80 }, (_, i) => {
    const shapes = [
      { w: `${5 + Math.random() * 9}px`, h: `${3 + Math.random() * 5}px`, br: '2px' },
      { w: `${6 + Math.random() * 6}px`, h: `${6 + Math.random() * 6}px`, br: '50%' },
      { w: `${3 + Math.random() * 4}px`, h: `${10 + Math.random() * 8}px`, br: '1px' },
    ];
    const sh = shapes[Math.floor(Math.random() * shapes.length)];
    const colors = ['#ffd700','#ffe566','#ff8800','#fff3a0','#ffffff','#ffcc44','#ff6600','#ffee88'];
    return {
      x: `${Math.random() * 100}%`,
      w: sh.w, h: sh.h, br: sh.br,
      c: colors[Math.floor(Math.random() * colors.length)],
      dur: `${1.4 + Math.random() * 4}s`,
      del: `${Math.random() * 2.2}s`,
      spin: `${(Math.random() - 0.5) * 1440}deg`,
    };
  }), []);

  return (
    <div className={s.confetti}>
      {pieces.map((p, i) => (
        <div key={i} className={s.piece} style={{
          '--x': p.x, '--w': p.w, '--h': p.h, '--br': p.br,
          '--c': p.c, '--dur': p.dur, '--del': p.del, '--spin': p.spin,
        }} />
      ))}
    </div>
  );
}

/* ─── Firework burst (SVG radiating sparks) ─── */
function FireworkBurst({ x, y, delay, color = '#ffd700', count = 14, radius = 90 }) {
  const sparks = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI;
    const len   = radius * (0.6 + Math.random() * 0.6);
    return { x2: Math.cos(angle) * len, y2: Math.sin(angle) * len };
  }), [count, radius]);

  return (
    <svg style={{ position: 'absolute', left: x, top: y, overflow: 'visible', width: 0, height: 0 }}>
      {sparks.map((sp, i) => (
        <line key={i} x1="0" y1="0" x2={sp.x2} y2={sp.y2}
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{
            transformOrigin: '0 0',
            animation: `fwSpark 2s ${delay + i * 0.04}s ease-out infinite`,
          }}
          opacity="0"
        />
      ))}
    </svg>
  );
}

/* Inject keyframes for firework spark once */
const FW_STYLE = `
@keyframes fwSpark {
  0%   { stroke-dasharray: 0 200; stroke-dashoffset: 0;   opacity: 0; transform: scale(0); }
  8%   { opacity: 1; transform: scale(1); }
  50%  { stroke-dasharray: 200 0; opacity: 0.8; }
  100% { opacity: 0; transform: scale(1.1); }
}`;

/* ─── Orbit particles ─── */
function OrbitParticles({ count = 18, radius = 105 }) {
  return (
    <div className={s.orbitRing}>
      {Array.from({ length: count }, (_, i) => {
        const start = (i / count) * 360;
        const speed = 3 + (i % 3) * 0.8;
        const size  = 4 + (i % 3) * 2;
        return (
          <div key={i} className={s.orbitDot} style={{
            width: size, height: size,
            '--ostart': `${start}deg`,
            '--or': `${radius}px`,
            '--od': `${speed}s`,
            '--odel': `${-(i * speed / count)}s`,
          }} />
        );
      })}
    </div>
  );
}

/* ─── Fire particles rising from base ─── */
function FireParticles({ count = 24 }) {
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: `${10 + Math.random() * 80}%`,
    bottom: `${4 + Math.random() * 18}%`,
    size: `${3 + Math.random() * 6}px`,
    dur: `${1.2 + Math.random() * 2.2}s`,
    del: `${Math.random() * 2.5}s`,
    dx: `${(Math.random() - 0.5) * 60}px`,
  })), []);

  return (
    <div className={s.fire}>
      {pts.map((p, i) => (
        <div key={i} className={s.firePt} style={{
          left: p.left, bottom: p.bottom,
          '--fs': p.size, '--fd': p.dur, '--fdd': p.del, '--fx': p.dx,
        }} />
      ))}
    </div>
  );
}

/* ─── Main celebration display ─── */
function NewKingDisplay({ king, phase }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [king?.id]);

  const fwPositions = useMemo(() => [
    { x: '8%',  y: '10%', col: '#ffd700', r: 80,  del: 0.0 },
    { x: '88%', y: '8%',  col: '#ff8800', r: 75,  del: 0.4 },
    { x: '4%',  y: '78%', col: '#ffe566', r: 70,  del: 0.8 },
    { x: '90%', y: '80%', col: '#ffcc44', r: 72,  del: 1.2 },
    { x: '50%', y: '5%',  col: '#ffffff', r: 65,  del: 0.6 },
    { x: '20%', y: '45%', col: '#ff6600', r: 60,  del: 1.5 },
    { x: '78%', y: '42%', col: '#ffd700', r: 68,  del: 1.9 },
  ], []);

  return (
    <div className={`${s.page} ${s['page_' + phase]}`}>
      <style>{FW_STYLE}</style>

      {/* Video background */}
      <video
        className={s.videoBg}
        src="/newking-bg.mp4"
        autoPlay loop muted playsInline
      />

      {/* Screen flash */}
      {phase === 'show' && <div className={s.flash} />}

      {/* Dark backdrop */}
      <div className={s.backdrop} />

      {/* Rotating god rays */}
      <div className={s.rays} />

      {/* Center bloom */}
      <div className={s.bloom} />

      {/* Shockwave rings */}
      <div className={s.shockwaves}>
        <div className={s.wave} />
        <div className={s.wave} />
        <div className={s.wave} />
        <div className={s.wave} />
      </div>

      {/* Corner & edge fireworks */}
      <div className={s.fireworks}>
        {fwPositions.map((fw, i) => (
          <FireworkBurst key={i}
            x={fw.x} y={fw.y}
            delay={fw.del} color={fw.col} radius={fw.r} count={14} />
        ))}
      </div>

      {/* Confetti rain */}
      <Confetti />

      {/* Fire particles at bottom */}
      <FireParticles count={28} />

      {/* Card */}
      <div className={s.card}>

        {/* Crown */}
        <img src="/crown-king.png" className={s.crown} alt="crown" draggable={false} />

        {/* Title */}
        <div className={s.title}>
          <span className={s.titleThai}>✦ ราชาคนใหม่ ✦</span>
          <span className={s.titleEn}>NEW KING</span>
        </div>

        {/* Avatar section */}
        <div className={s.avatarSection}>
          {/* Orbit particles */}
          <OrbitParticles count={20} radius={108} />

          {/* Rotating rings */}
          <div className={s.ringOuter} />
          <div className={s.ringMid} />
          <div className={s.ringInner} />

          {/* Gold bloom */}
          <div className={s.avatarGlow} />

          {/* Avatar */}
          <div className={s.avatarCircle}>
            {!imgErr && king.profilePicUrl ? (
              <img src={king.profilePicUrl} alt={king.displayName}
                className={s.avatarImg} onError={() => setImgErr(true)} />
            ) : (
              <div className={s.avatarFallback}>
                {(king.displayName || king.username || '?')[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Lightning orbit */}
          <LightningRing size={220} />
        </div>

        {/* Name */}
        <div className={s.name}>{king.displayName || king.username}</div>

        {/* Wins */}
        <div className={s.wins}>
          <span className={s.winsNum}>{king.win}</span>
          <span className={s.winsLabel}>WINS</span>
        </div>

      </div>
    </div>
  );
}

const PREVIEW_KING = {
  id: 'preview', username: 'preview',
  displayName: 'ราชาคนใหม่',
  profilePicUrl: null,
  win: 99,
};

/* ─── Page root ─── */
export default function NewKingPage() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [king, setKing]   = useState(isPreview ? PREVIEW_KING : null);
  const [phase, setPhase] = useState(isPreview ? 'show' : 'enter');
  const timers = useRef([]);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';

    if (isPreview) return;

    socket.on('newKing', (data) => {
      timers.current.forEach(clearTimeout);
      setKing(data);
      setPhase('enter');
      timers.current = [
        setTimeout(() => setPhase('show'),  80),
        setTimeout(() => setPhase('exit'),  7200),
        setTimeout(() => setKing(null),     8000),
      ];
    });

    return () => { socket.off('newKing'); timers.current.forEach(clearTimeout); };
  }, []);

  if (!king) return null;

  return <NewKingDisplay key={king.id + '_' + king.win} king={king} phase={phase} />;
}
