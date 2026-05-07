import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import s from './Top1.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

/* ─── Lightning ring (same engine as NewKing) ─── */
function makeBolt(cx, cy, r, startDeg, arcDeg, jitter, color, opacity, thick) {
  const steps = Math.max(4, Math.floor(arcDeg / 5));
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
  const COLS = ['#ffffff', '#fff9c0', '#ffe566', '#ffd700', '#ff8800'];
  const bolts = [];
  for (let b = 0; b < 7; b++) {
    const start = Math.random() * 360;
    const arc   = 18 + Math.random() * 90;
    const jit   = 6 + Math.random() * 9;
    const col   = COLS[Math.floor(Math.random() * COLS.length)];
    const op    = 0.5 + Math.random() * 0.5;
    const thick = Math.random() < 0.25;
    bolts.push(makeBolt(cx, cy, r,     start, arc,       jit,     col,      op,       thick));
    bolts.push(makeBolt(cx, cy, r + 4, start, arc * 0.5, jit * 0.4, '#ff8800', op * 0.3, false));
  }
  return bolts;
}

function LightningRing({ radius, pad = 28 }) {
  const sz = radius * 2 + pad * 2, cx = sz / 2, cy = sz / 2;
  const [bolts, setBolts] = useState(() => buildLightning(cx, cy, radius));
  const rafRef  = useRef(null);
  const lastRef = useRef(0);

  useEffect(() => {
    const tick = (now) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - lastRef.current < 1000 / 28) return;
      lastRef.current = now;
      setBolts(buildLightning(cx, cy, radius));
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <svg className={s.lightning}
      style={{ width: sz, height: sz, top: -pad, left: -pad }}
      viewBox={`0 0 ${sz} ${sz}`}>
      <defs>
        <filter id="t1g" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {bolts.map((b, i) => (
        <path key={i} d={b.d} fill="none" stroke={b.color}
          strokeWidth={b.thick ? 3 : 1.4} strokeLinecap="round"
          opacity={b.opacity} filter="url(#t1g)" />
      ))}
    </svg>
  );
}

/* ─── Orbit particles ─── */
function OrbitParticles({ count = 14, radius = 120 }) {
  return (
    <div className={s.orbitRing}>
      {Array.from({ length: count }, (_, i) => {
        const start = (i / count) * 360;
        const speed = 3.5 + (i % 3) * 0.7;
        const size  = 4 + (i % 3) * 2;
        return (
          <div key={i} className={s.orbitDot} style={{
            width: size, height: size,
            '--ostart': `${start}deg`,
            '--or':     `${radius}px`,
            '--od':     `${speed}s`,
            '--odel':   `${-(i * speed / count)}s`,
          }} />
        );
      })}
    </div>
  );
}

/* ─── Rising ember sparks ─── */
function Embers({ count = 16 }) {
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left:  `${20 + Math.random() * 60}%`,
    size:  `${2 + Math.random() * 4}px`,
    dur:   `${1.4 + Math.random() * 2}s`,
    del:   `${Math.random() * 3}s`,
    dx:    `${(Math.random() - 0.5) * 50}px`,
    col:   ['#ffd700','#ff8800','#fff5a0','#ff6600'][Math.floor(Math.random() * 4)],
  })), []);

  return (
    <div className={s.embers}>
      {pts.map((p, i) => (
        <div key={i} className={s.ember} style={{
          left: p.left, '--es': p.size, '--ed': p.dur,
          '--edd': p.del, '--ex': p.dx, '--ec': p.col,
        }} />
      ))}
    </div>
  );
}

/* ─── Main card ─── */
function Top1Card({ player }) {
  const [imgErr, setImgErr] = useState(false);
  const [bump,   setBump]   = useState(false);
  const prevId  = useRef(null);
  const prevWin = useRef(null);

  useEffect(() => { setImgErr(false); }, [player?.id]);

  useEffect(() => {
    if (!player) return;
    if (player.id !== prevId.current || player.win !== prevWin.current) {
      setBump(false);
      requestAnimationFrame(() => setBump(true));
      prevId.current  = player.id;
      prevWin.current = player.win;
    }
  }, [player?.id, player?.win]);

  if (!player) return null;

  return (
    <div className={`${s.widget} ${bump ? s.update : ''}`}>

      {/* Title */}
      <div className={s.titleWrap}>
        <span className={s.titleLine}>TOP 1 IN MY LIVE</span>
      </div>

      {/* Frame + avatar + all FX */}
      <div className={s.frameWrap}>

        {/* God rays rotating behind everything */}
        <div className={s.rays} />

        {/* Aura glow blob */}
        <div className={s.aura} />

        {/* Orbit particles */}
        <OrbitParticles count={14} radius={118} />

        {/* Lightning arcs */}
        <LightningRing radius={106} pad={32} />

        {/* Avatar */}
        <div className={s.avatarCircle}>
          {!imgErr && player.profilePicUrl ? (
            <img src={player.profilePicUrl} alt={player.displayName}
              className={s.avatarImg} onError={() => setImgErr(true)} />
          ) : (
            <div className={s.avatarFallback}>
              {(player.displayName || player.username || '?')[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Ornate frame — static, no spin */}
        <img src="/frame-top1.png" className={s.frameImg} alt="" draggable={false} />


        {/* Rising embers */}
        <Embers count={18} />
      </div>

      {/* Name */}
      <div className={s.name}>{player.displayName || player.username}</div>

      {/* Wins */}
      <div className={s.wins}>
        <span className={s.winsNum}>{player.win}</span>
        <span className={s.winsLabel}>WINS</span>
      </div>

    </div>
  );
}

export default function Top1Page() {
  const [lockedTop, setLockedTop] = useState(null);
  const lockedRef = useRef(null);
  // หลัง reset เก็บ { id, win } ของคนที่ถูกล้าง — ต้อง win เกินนี้ถึงจะแสดงใหม่
  const thresholdRef = useRef(null);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';

    socket.on('top1Reset', () => {
      const cur = lockedRef.current;
      if (cur) {
        thresholdRef.current = { id: cur.id, win: cur.win };
      } else {
        thresholdRef.current = null;
      }
      lockedRef.current = null;
      setLockedTop(null);
    });

    socket.on('players', (players) => {
      const top = players[0];
      if (!top) return;

      const cur = lockedRef.current;
      const threshold = thresholdRef.current;

      if (!cur) {
        // ยังไม่มีราชา — ตรวจว่าผ่าน threshold หรือยัง
        if (threshold) {
          if (top.id === threshold.id && top.win <= threshold.win) {
            // คนเดิม win ยังไม่เกิน threshold — ยังไม่แสดง
            return;
          }
          // ผ่าน threshold แล้ว (คนใหม่ หรือ คนเดิม win เพิ่ม) — ล็อคและล้าง threshold
          thresholdRef.current = null;
        }
        lockedRef.current = top;
        setLockedTop(top);
        return;
      }

      if (top.id === cur.id && top.win >= cur.win) {
        // คนเดิม win เพิ่ม — อัปเดต
        lockedRef.current = top;
        setLockedTop(top);
      } else if (top.id !== cur.id && top.win > cur.win) {
        // คนใหม่ win มากกว่าจริงๆ — เปลี่ยนราชา
        thresholdRef.current = null;
        lockedRef.current = top;
        setLockedTop(top);
      }
      // ทุกกรณีอื่น — ล็อคไว้
    });

    return () => { socket.off('players'); socket.off('top1Reset'); };
  }, []);

  return (
    <div className={s.page}>
      {lockedTop && <Top1Card key={lockedTop.id} player={lockedTop} />}
    </div>
  );
}
