import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import styles from './Overlay.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });
const ROOM_USER = new URLSearchParams(window.location.search).get('u') || '';
function joinRoom() { if (ROOM_USER) socket.emit('joinRoom', { username: ROOM_USER }); }
socket.on('connect', joinRoom);
joinRoom();

const CONFIGS = [
  { playerIdx: 1, rank: 2, barH: 105, barGrad: 'linear-gradient(180deg,#c8c8e0 0%,#6a6a8a 100%)', avatarSize: 80,  frameSize: 144, label: 'silver', avatarOffsetY: -13 },
  { playerIdx: 0, rank: 1, barH: 148, barGrad: 'linear-gradient(180deg,#ffe566 0%,#f0a800 45%,#c06000 100%)',      avatarSize: 106, frameSize: 192, label: 'gold',   avatarOffsetY: -18 },
  { playerIdx: 2, rank: 3, barH: 80,  barGrad: 'linear-gradient(180deg,#d49060 0%,#8a4020 100%)', avatarSize: 71,  frameSize: 128, label: 'bronze', avatarOffsetY: -12 },
];

const FRAME_SRCS = ['/frame-rank1.png', '/frame-rank2.png', '/frame-rank3.png'];

const RC = {
  gold:   { core:'#ffffff', hi:'#fff9c0', mid:'#ffe566', outer:'#ff8800', glow:'#ffd700', ray:'#ffe03a' },
  silver: { core:'#ffffff', hi:'#e8f4ff', mid:'#c8e4ff', outer:'#2255ee', glow:'#66aaff', ray:'#99ccff' },
  bronze: { core:'#ffffff', hi:'#fff0dd', mid:'#ffcc88', outer:'#cc3300', glow:'#ff6600', ray:'#ffaa44' },
};

/* ─── zigzag lightning bolt along a circle ─── */
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

function buildFrame(cx, cy, r, label, isGold) {
  const c = RC[label];
  const bolts = [];
  const count = isGold ? 6 : 3;

  for (let b = 0; b < count; b++) {
    const start = Math.random() * 360;
    const arc = isGold ? 25 + Math.random() * 100 : 18 + Math.random() * 70;
    const jit  = isGold ? 6 + Math.random() * 8 : 4 + Math.random() * 5;
    const roll = Math.random();
    const col  = roll < 0.25 ? c.core : roll < 0.55 ? c.hi : roll < 0.78 ? c.mid : c.outer;
    const op   = 0.6 + Math.random() * 0.4;
    bolts.push(makeBolt(cx, cy, r, start, arc, jit, col, op, roll < 0.2));
    // glow echo
    if (Math.random() > 0.35)
      bolts.push(makeBolt(cx, cy, r + 4, start, arc * 0.7, jit * 0.4, c.outer, op * 0.3, false));
  }

  // base shimmer arcs
  const shimmerCount = isGold ? 5 : 3;
  for (let s = 0; s < shimmerCount; s++) {
    const start = (s * (360 / shimmerCount)) + Math.random() * 18;
    const arc   = 18 + Math.random() * 28;
    bolts.push(makeBolt(cx, cy, r - 3, start, arc, 1.2, c.glow, 0.14 + Math.random() * 0.1, false));
  }

  return bolts;
}

/* ─── extra outer ring for gold ─── */
function buildOuterRing(cx, cy, r, label) {
  const c = RC[label];
  const bolts = [];
  for (let b = 0; b < 5; b++) {
    const start = Math.random() * 360;
    const arc   = 15 + Math.random() * 60;
    const jit   = 5 + Math.random() * 9;
    const col   = Math.random() < 0.5 ? c.mid : c.outer;
    bolts.push(makeBolt(cx, cy, r, start, arc, jit, col, 0.4 + Math.random() * 0.4, false));
  }
  return bolts;
}

function LightningOrbit({ label, frameSize, isGold }) {
  const c = RC[label];
  // r matches the outer circular border of the wreath frame image (~87.5% of half-size)
  const r      = Math.round(frameSize * 0.4375);
  const rOuter = Math.round(frameSize * 0.505);   // gold outer ring just at frame edge
  const pad    = isGold ? 28 : 18;
  const svgSz  = frameSize + pad * 2;
  const cx     = svgSz / 2, cy = svgSz / 2;

  const [inner, setInner] = useState(() => buildFrame(cx, cy, r, label, isGold));
  const [outer, setOuter] = useState(() => isGold ? buildOuterRing(cx, cy, rOuter, label) : []);
  const ref = useRef(null);

  useEffect(() => {
    let t = 0;
    ref.current = setInterval(() => {
      t++;
      setInner(buildFrame(cx, cy, r, label, isGold));
      if (isGold) setOuter(buildOuterRing(cx, cy, rOuter, label));
    }, isGold ? 48 : 60);
    return () => clearInterval(ref.current);
  }, []);

  const fid = `f-${label}`;
  const fidSoft = `fs-${label}`;

  return (
    <svg className={styles.orbitSvg}
      style={{ width: svgSz, height: svgSz, top: -pad, left: -pad }}
      viewBox={`0 0 ${svgSz} ${svgSz}`}>
      <defs>
        <filter id={fid} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={isGold ? '4' : '3'} result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={fidSoft} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ambient halo rings */}
      <circle cx={cx} cy={cy} r={r}        fill="none" stroke={c.glow} strokeWidth={isGold?10:6} opacity={isGold?'0.12':'0.07'} filter={`url(#${fidSoft})`}/>
      {isGold && <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={c.outer} strokeWidth="6" opacity="0.08" filter={`url(#${fidSoft})`}/>}

      {/* inner ring bolts */}
      {inner.map((b, i) => (
        <path key={`i${i}`} d={b.d} fill="none"
          stroke={b.color} strokeWidth={b.thick ? 2.8 : 1.4}
          strokeLinecap="round" strokeLinejoin="round"
          opacity={b.opacity} filter={`url(#${fid})`}/>
      ))}

      {/* outer ring bolts (gold only) */}
      {isGold && outer.map((b, i) => (
        <path key={`o${i}`} d={b.d} fill="none"
          stroke={b.color} strokeWidth="1.2"
          strokeLinecap="round" strokeLinejoin="round"
          opacity={b.opacity} filter={`url(#${fid})`}/>
      ))}
    </svg>
  );
}

/* ─── Rotating golden rays (gold only) ─── */
function GoldenRays({ size }) {
  const n = 12;
  const cx = size / 2, cy = size / 2;
  const inner = size * 0.44, outer = size * 0.62;
  const rays = Array.from({ length: n }, (_, i) => {
    const a = (i * 360 / n) * Math.PI / 180;
    return { x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a), x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a) };
  });
  return (
    <svg className={styles.rayssvg} style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}>
      <defs>
        <filter id="rayblur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#ffe566" strokeWidth="3" opacity="0.55" filter="url(#rayblur)"/>
      ))}
      {rays.map((r, i) => (
        <line key={`c${i}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="#ffffff" strokeWidth="1" opacity="0.4"/>
      ))}
    </svg>
  );
}

/* ─── Floating particles (gold only) ─── */
function Particles({ count = 16, areaSize }) {
  return (
    <div className={styles.particles} style={{ width: areaSize, height: areaSize, top: `calc(50% - ${areaSize / 2}px)`, left: `calc(50% - ${areaSize / 2}px)` }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.particle} style={{ '--pi': i, '--pt': count }} />
      ))}
    </div>
  );
}

/* ─── Gold FX: divine bloom + god rays + lens flares ─── */
function FxGold() {
  return (
    <>
      <div className={styles.goldBloom} />
      {[
        { s: 9,  t: '10%', l: '12%', c: '#fff9c0', fd: '2.1s', fd2: '0.0s' },
        { s: 5,  t:  '7%', r: '16%', c: '#ffe566', fd: '2.8s', fd2: '0.7s' },
        { s: 13, t: '42%', l:  '6%', c: '#ffffff', fd: '3.4s', fd2: '1.4s' },
        { s: 6,  t: '28%', r:  '9%', c: '#fff3a0', fd: '1.9s', fd2: '2.0s' },
        { s: 4,  t: '68%', l: '22%', c: '#ffd700', fd: '1.6s', fd2: '1.0s' },
        { s: 7,  t: '80%', r: '18%', c: '#ffe0a0', fd: '2.5s', fd2: '0.5s' },
      ].map((f, i) => (
        <div key={i} className={styles.lensFlare} style={{
          width: f.s, height: f.s,
          top: f.t, left: f.l, right: f.r,
          background: f.c,
          boxShadow: `0 0 ${f.s * 2}px ${f.c}, 0 0 ${f.s * 5}px ${f.c}99`,
          '--fd': f.fd, '--fd2': f.fd2,
        }} />
      ))}
    </>
  );
}

/* ─── Silver FX: frost aura + ice star flashes + rotating ring ─── */
function FxSilver() {
  return (
    <>
      <div className={styles.silverBloom} />
      <div className={styles.silverRingWrap}>
        <svg className={styles.silverRingSvg} viewBox="0 0 240 240">
          <circle cx="120" cy="120" r="108" fill="none" stroke="rgba(160,220,255,0.35)" strokeWidth="1.2" strokeDasharray="10 14" />
          <circle cx="120" cy="120" r="95"  fill="none" stroke="rgba(200,240,255,0.20)" strokeWidth="0.8" strokeDasharray="5 18" />
        </svg>
      </div>
      {[
        { t: '8%',  l: '14%', is: '3.0s', id: '0.0s' },
        { t: '12%', r: '16%', is: '3.6s', id: '0.9s' },
        { t: '55%', l:  '7%', is: '2.4s', id: '1.6s' },
        { t: '48%', r: '11%', is: '3.2s', id: '0.4s' },
        { t: '72%', l: '28%', is: '2.8s', id: '1.2s' },
        { t: '78%', r: '24%', is: '3.8s', id: '2.0s' },
      ].map((s, i) => (
        <div key={i} className={styles.iceStar} style={{
          top: s.t, left: s.l, right: s.r,
          '--is': s.is, '--id': s.id,
        }} />
      ))}
    </>
  );
}

/* ─── Bronze FX: fire bloom flicker + rising embers ─── */
function FxBronze() {
  const embers = [
    { l: '18%', ed: '2.3s', edd: '0.0s', ex: -0.3 },
    { l: '32%', ed: '1.9s', edd: '0.6s', ex:  0.2 },
    { l: '48%', ed: '2.7s', edd: '1.2s', ex: -0.1 },
    { l: '63%', ed: '2.1s', edd: '0.3s', ex:  0.4 },
    { l: '78%', ed: '1.7s', edd: '0.9s', ex: -0.2 },
    { l: '26%', ed: '3.1s', edd: '1.7s', ex:  0.1 },
    { l: '55%', ed: '2.5s', edd: '0.5s', ex: -0.4 },
    { l: '70%', ed: '1.5s', edd: '1.4s', ex:  0.3 },
  ];
  return (
    <>
      <div className={styles.bronzeBloom} />
      <div className={styles.bronzeInnerGlow} />
      {embers.map((e, i) => (
        <div key={i} className={styles.ember} style={{
          left: e.l, bottom: '30%',
          '--ed': e.ed, '--edd': e.edd, '--ex': e.ex,
        }} />
      ))}
    </>
  );
}

function Sparkles({ count = 10 }) {
  return (
    <div className={styles.sparkles}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.sparkle} style={{ '--i': i, '--n': count }} />
      ))}
    </div>
  );
}

function Avatar({ player, cfg }) {
  const [err, setErr] = useState(false);
  const isGold = cfg.rank === 1;
  useEffect(() => { setErr(false); }, [player.id, player.profilePicUrl]);

  return (
    <div className={styles.avatarWrap} style={{ width: cfg.frameSize, height: cfg.frameSize }}>
      <div className={`${styles.avatarCircle} ${isGold ? styles.avatarCircleGold : ''}`}
        style={{ width: cfg.avatarSize, height: cfg.avatarSize, marginTop: cfg.avatarOffsetY ?? 0 }}>
        {!err && player.profilePicUrl ? (
          <img src={player.profilePicUrl} alt={player.displayName}
            className={styles.avatarImg} onError={() => setErr(true)}/>
        ) : (
          <div className={styles.avatarFallback}>
            {(player.displayName || player.username)[0].toUpperCase()}
          </div>
        )}
      </div>
      <img src={FRAME_SRCS[cfg.rank - 1]}
        className={`${styles.frameImg} ${styles['frame_' + cfg.label]}`}
        alt="" draggable={false}/>
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
            <div key={cfg.rank} className={`${styles.column} ${isFirst ? styles.colFirst : ''}`}>
              <div className={`${styles.card} ${styles[cfg.label + 'Card']}`}>
                {cfg.rank === 1 && <FxGold />}
                {cfg.rank === 2 && <FxSilver />}
                {cfg.rank === 3 && <FxBronze />}
                {isFirst && <Sparkles count={12} />}
                {isFirst && <Particles count={18} areaSize={cfg.frameSize * 1.6} />}

                {isFirst && (
                  <div className={`${styles.crownWrap} ${styles.crownFirst}`}>
                    <img src="/crown-king.png" className={styles.crownKing} alt="crown" draggable={false}/>
                  </div>
                )}

                <Avatar player={p} cfg={cfg} />

                <div className={`${styles.playerName} ${
                  cfg.rank === 1 ? styles.nameFirst :
                  cfg.rank === 2 ? styles.nameSilver :
                  styles.nameBronze
                }`}>
                  {p.displayName || p.username}
                </div>

                <div className={`${styles.winsBadge} ${styles[cfg.label + 'WinsBadge']}`}>
                  <span className={`${styles.winsNum} ${styles[cfg.label + 'WinsNum']}`}>{p.win}</span>
                  <span className={styles.winsLabel}>WINS</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
