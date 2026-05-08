import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import s from './TopGifter.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });
const ROOM_USER = new URLSearchParams(window.location.search).get('u') || '';
function joinRoom() { if (ROOM_USER) socket.emit('joinRoom', { username: ROOM_USER }); }
socket.on('connect', joinRoom);
joinRoom();

/* ── Star / sparkle particles ── */
function StarRain({ count = 40 }) {
  const stars = useMemo(() => Array.from({ length: count }, () => ({
    left:    `${Math.random() * 100}%`,
    size:    `${8 + Math.random() * 16}px`,
    dur:     `${2 + Math.random() * 4}s`,
    del:     `${Math.random() * 3}s`,
    opacity: 0.4 + Math.random() * 0.6,
    color:   ['#ffd700','#ffe566','#fff','#a78bfa','#38bdf8','#e040fb'][Math.floor(Math.random()*6)],
  })), []);

  return (
    <div className={s.starRain}>
      {stars.map((g, i) => (
        <div key={i} className={s.starPt} style={{
          left: g.left, width: g.size, height: g.size,
          '--dur': g.dur, '--del': g.del, '--opacity': g.opacity, '--color': g.color,
        }}>
          <svg viewBox="0 0 24 24" fill={g.color}>
            <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/>
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
    dist:  90 + Math.random() * 30,
    dur:   `${0.8 + Math.random() * 1}s`,
    del:   `${i * 0.1}s`,
    sz:    `${4 + Math.random() * 6}px`,
    color: ['#ffd700','#e040fb','#fff','#a78bfa','#38bdf8'][i % 5],
  })), []);

  return (
    <div className={s.sparkleRing} style={{ width: size, height: size }}>
      {sparks.map((sp, i) => {
        const rad = (sp.angle * Math.PI) / 180;
        const x   = 50 + (sp.dist / size * 100) * Math.cos(rad);
        const y   = 50 + (sp.dist / size * 100) * Math.sin(rad);
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

/* ── Level ticker (counts up) ── */
function LevelCount({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.max(1, Math.ceil(value / 20));
    const t = setInterval(() => {
      cur = Math.min(cur + step, value);
      setDisplay(cur);
      if (cur >= value) clearInterval(t);
    }, 50);
    return () => clearInterval(t);
  }, [value]);
  return <span>{display}</span>;
}

/* ── Main display ── */
function TopGifterDisplay({ gifter, phase }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [gifter?.uniqueId]);

  return (
    <div className={`${s.page} ${s['page_' + phase]}`}>
      {phase === 'show' && <div className={s.flash} />}
      <div className={s.backdrop} />
      <div className={s.rays} />
      <div className={s.bloom} />
      <ShockWaves />
      <StarRain count={35} />

      <div className={s.card}>

        {/* Top badge */}
        <div className={s.badge}>
          <span className={s.badgeStar}>⭐</span>
          <span className={s.badgeText}>HIGH LEVEL</span>
          <span className={s.badgeStar}>⭐</span>
        </div>

        {/* Subtitle */}
        <div className={s.subtitle}>เข้าร่วมไลฟ์แล้ว!</div>

        {/* Avatar */}
        <div className={s.avatarSection}>
          <SparkleRing size={230} />
          <div className={s.ringOuter} />
          <div className={s.ringMid}   />
          <div className={s.ringInner} />
          <div className={s.avatarGlow} />

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
          <div className={s.avatarFrame} />
        </div>

        {/* Name */}
        <div className={s.name}>{gifter.displayName || gifter.uniqueId}</div>

        {/* Level badge */}
        <div className={s.levelRow}>
          <span className={s.levelLabel}>LV.</span>
          <span className={s.levelNum}><LevelCount value={gifter.level || 0} /></span>
        </div>

      </div>
    </div>
  );
}

const PREVIEW_GIFTER = {
  uniqueId: 'preview', displayName: 'Moon 🌙', profilePicUrl: null, level: 25,
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
