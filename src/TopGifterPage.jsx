import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import s from './TopGifter.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });
const ROOM_USER = new URLSearchParams(window.location.search).get('u') || '';
function joinRoom() { if (ROOM_USER) socket.emit('joinRoom', { username: ROOM_USER }); }
socket.on('connect', joinRoom);
joinRoom();

/* ── Diamond particles ── */
function DiamondRain({ count = 40 }) {
  const gems = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left:  `${Math.random() * 100}%`,
    size:  `${10 + Math.random() * 18}px`,
    dur:   `${2 + Math.random() * 4}s`,
    del:   `${Math.random() * 3}s`,
    opacity: 0.4 + Math.random() * 0.6,
    rotate: `${Math.random() * 360}deg`,
    color: ['#b9f2ff','#e040fb','#ffd700','#fff','#a78bfa','#38bdf8'][Math.floor(Math.random()*6)],
  })), []);

  return (
    <div className={s.diamondRain}>
      {gems.map((g, i) => (
        <div key={i} className={s.gem} style={{
          left: g.left, width: g.size, height: g.size,
          '--dur': g.dur, '--del': g.del,
          '--opacity': g.opacity, '--rotate': g.rotate, '--color': g.color,
        }}>
          <svg viewBox="0 0 24 24" fill={g.color}>
            <polygon points="12,2 22,9 18,22 6,22 2,9" opacity="0.9"/>
            <polygon points="12,2 22,9 12,14" opacity="0.5" fill="white"/>
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ── Shockwave rings ── */
function ShockWaves() {
  return (
    <div className={s.shockwaves}>
      {[0,1,2,3].map(i => <div key={i} className={s.wave} style={{ '--wdel': `${i * 0.4}s` }} />)}
    </div>
  );
}

/* ── Sparkle burst around avatar ── */
function SparkleRing({ size = 220 }) {
  const sparks = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    angle: (i / 16) * 360,
    dist: 90 + Math.random() * 30,
    dur: `${0.8 + Math.random() * 1}s`,
    del: `${i * 0.1}s`,
    sz: `${4 + Math.random() * 6}px`,
    color: ['#ffd700','#e040fb','#b9f2ff','#fff','#a78bfa'][i % 5],
  })), []);

  return (
    <div className={s.sparkleRing} style={{ width: size, height: size }}>
      {sparks.map((sp, i) => {
        const rad = (sp.angle * Math.PI) / 180;
        const x = 50 + (sp.dist / size * 100) * Math.cos(rad);
        const y = 50 + (sp.dist / size * 100) * Math.sin(rad);
        return (
          <div key={i} className={s.sparkle} style={{
            left: `${x}%`, top: `${y}%`,
            width: sp.sz, height: sp.sz,
            '--sdur': sp.dur, '--sdel': sp.del,
            background: sp.color,
          }} />
        );
      })}
    </div>
  );
}

/* ── Number ticker (diamonds) ── */
function DiamondCount({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 30);
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

/* ── Main display ── */
function TopGifterDisplay({ gifter, phase }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [gifter?.uniqueId]);

  return (
    <div className={`${s.page} ${s['page_' + phase]}`}>
      {/* Screen flash */}
      {phase === 'show' && <div className={s.flash} />}

      {/* Dark vignette */}
      <div className={s.backdrop} />

      {/* Rotating god rays (purple/pink) */}
      <div className={s.rays} />

      {/* Center bloom */}
      <div className={s.bloom} />

      {/* Shockwave rings */}
      <ShockWaves />

      {/* Diamond rain */}
      <DiamondRain count={35} />

      {/* Card */}
      <div className={s.card}>

        {/* Top badge */}
        <div className={s.badge}>
          <span className={s.badgeGem}>💎</span>
          <span className={s.badgeText}>TOP GIFTER</span>
          <span className={s.badgeGem}>💎</span>
        </div>

        {/* Subtitle */}
        <div className={s.subtitle}>เข้าร่วมไลฟ์แล้ว!</div>

        {/* Avatar section */}
        <div className={s.avatarSection}>
          <SparkleRing size={230} />

          {/* Glow rings */}
          <div className={s.ringOuter} />
          <div className={s.ringMid}   />
          <div className={s.ringInner} />
          <div className={s.avatarGlow} />

          {/* Avatar */}
          <div className={s.avatarCircle}>
            {!imgErr && gifter.profilePicUrl ? (
              <img src={gifter.profilePicUrl} alt={gifter.displayName}
                className={s.avatarImg} onError={() => setImgErr(true)} />
            ) : (
              <div className={s.avatarFallback}>
                {(gifter.displayName || gifter.uniqueId || '?')[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Diamond frame border */}
          <div className={s.avatarFrame} />
        </div>

        {/* Name */}
        <div className={s.name}>{gifter.displayName || gifter.uniqueId}</div>

        {/* Diamond count */}
        <div className={s.diamondRow}>
          <span className={s.diamondIcon}>💎</span>
          <span className={s.diamondNum}><DiamondCount value={gifter.diamonds} /></span>
          <span className={s.diamondLabel}>diamonds</span>
        </div>

      </div>
    </div>
  );
}

const PREVIEW_GIFTER = {
  uniqueId: 'preview', displayName: 'TOP GIFTER', profilePicUrl: null, diamonds: 12345,
};

export default function TopGifterPage() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [gifter, setGifter] = useState(isPreview ? PREVIEW_GIFTER : null);
  const [phase,  setPhase]  = useState(isPreview ? 'show' : 'enter');
  const timers = useRef([]);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    if (isPreview) return;

    socket.on('topGifterEnter', (data) => {
      timers.current.forEach(clearTimeout);
      setGifter(data);
      setPhase('enter');
      timers.current = [
        setTimeout(() => setPhase('show'),  80),
        setTimeout(() => setPhase('exit'),  7500),
        setTimeout(() => setGifter(null),   8300),
      ];
    });

    return () => { socket.off('topGifterEnter'); timers.current.forEach(clearTimeout); };
  }, []);

  if (!gifter) return null;
  return <TopGifterDisplay key={gifter.uniqueId} gifter={gifter} phase={phase} />;
}
