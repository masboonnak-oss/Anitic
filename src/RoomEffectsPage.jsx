import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

/* ── URL params ── */
const params   = new URLSearchParams(window.location.search);
const ROOM_USER = (params.get('u') || '').toLowerCase();
const IS_PREVIEW = params.has('preview');
const IS_DEMO    = params.has('demo');

/* ── Standalone socket (doesn't need auth) ── */
const sock = io('/', { transports: ['websocket', 'polling'] });
function joinRoom() { if (ROOM_USER) sock.emit('joinRoom', { username: ROOM_USER }); }
sock.on('connect', joinRoom);

/* ── Demo item ── */
const DEMO_ITEM = {
  _uid: 'demo-1',
  variant: 'join',
  uniqueId: 'babynoey',
  displayName: 'BabyNoey 👑',
  profilePicUrl: null,
  level: 30,
};

/* ── helpers ── */
function addToQueue(prev, item) {
  const next = [...prev, item];
  return next.length > 3 ? next.slice(next.length - 3) : next;
}

/* ════════════════════════════════════════
   VIP Join Card
════════════════════════════════════════ */
function VIPJoinCard({ item, onDone }) {
  const isVIP = (item.level || 0) >= 20;

  useEffect(() => {
    const t = setTimeout(onDone, 6500);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ x: -500, opacity: 0, scale: 0.7, rotateY: -25 }}
      animate={{ x: 0, opacity: 1, scale: 1, rotateY: 0 }}
      exit={{ x: -500, opacity: 0, scale: 0.8, filter: 'blur(12px)' }}
      transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.8 }}
      style={{ position: 'relative', width: '100%', maxWidth: 600, perspective: '1200px' }}
    >
      {/* outer glow halo */}
      <div style={{
        position: 'absolute', inset: '-24px', borderRadius: '24px', pointerEvents: 'none',
        background: isVIP
          ? 'radial-gradient(ellipse, rgba(255,200,30,0.35) 0%, rgba(200,80,255,0.25) 40%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(155,81,224,0.3) 0%, transparent 70%)',
        filter: 'blur(20px)', animation: 'divineBreath 2s ease-in-out infinite',
      }} />

      {/* light rays (VIP only) */}
      {isVIP && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
          {[...Array(12)].map((_, i) => (
            <motion.div key={i}
              style={{
                position: 'absolute', left: 60, top: 40, width: 400, height: 2,
                rotate: `${i * 30}deg`, transformOrigin: '0 50%', borderRadius: 99,
                background: `linear-gradient(to right, ${i % 2 === 0 ? 'rgba(255,200,50,0.8)' : 'rgba(220,80,255,0.6)'}, transparent)`,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: [0, 1, 0.8, 1], opacity: [0, 0.9, 0.6, 0.8] }}
              transition={{ duration: 0.8 + i * 0.05, delay: 0.1, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.5 }}
            />
          ))}
        </div>
      )}

      {/* main card */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16, border: '2px solid',
        backdropFilter: 'blur(24px)',
        background: isVIP
          ? 'linear-gradient(135deg,rgba(20,8,40,.97) 0%,rgba(40,12,60,.97) 40%,rgba(20,8,30,.97) 100%)'
          : 'linear-gradient(135deg,rgba(15,8,35,.97) 0%,rgba(30,10,55,.97) 100%)',
        borderColor: isVIP ? 'rgba(255,190,30,0.7)' : 'rgba(155,81,224,0.6)',
        boxShadow: isVIP
          ? '0 0 40px rgba(255,190,30,0.5),0 0 80px rgba(200,80,255,0.3),inset 0 1px 0 rgba(255,220,80,0.2)'
          : '0 0 30px rgba(155,81,224,0.6),inset 0 1px 0 rgba(155,81,224,0.2)',
      }}>
        {/* top sweep */}
        <motion.div
          style={{
            position: 'absolute', top: 0, left: 0, height: 2, borderRadius: 99,
            background: isVIP
              ? 'linear-gradient(to right,transparent,rgba(255,200,50,1),rgba(255,100,255,1),transparent)'
              : 'linear-gradient(to right,transparent,rgba(155,81,224,1),rgba(236,72,153,1),transparent)',
          }}
          initial={{ width: '0%', left: '50%' }}
          animate={{ width: '100%', left: '0%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* scanlines */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1,
          backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)',
        }} />

        {/* corners */}
        {[['top:8px;left:8px;border-top:2px solid;border-left:2px solid;border-radius:6px 0 0 0', 'tl'],
          ['top:8px;right:8px;border-top:2px solid;border-right:2px solid;border-radius:0 6px 0 0', 'tr'],
          ['bottom:8px;left:8px;border-bottom:2px solid;border-left:2px solid;border-radius:0 0 0 6px', 'bl'],
          ['bottom:8px;right:8px;border-bottom:2px solid;border-right:2px solid;border-radius:0 0 6px 0', 'br'],
        ].map(([s, k]) => (
          <div key={k} style={{
            position: 'absolute', width: 20, height: 20,
            ...Object.fromEntries(s.split(';').filter(Boolean).map(p => { const [k,v]=p.split(':'); return [k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v?.trim()]; })),
            borderColor: isVIP ? 'rgba(255,200,50,0.8)' : 'rgba(155,81,224,0.7)',
          }} />
        ))}

        <div style={{ position: 'relative', padding: 16, display: 'flex', alignItems: 'center', gap: 16, zIndex: 2 }}>
          {/* avatar */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
            style={{ position: 'relative', flexShrink: 0 }}
          >
            {isVIP && (
              <motion.div
                style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 22 }}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: [0, -4, 0], opacity: 1 }}
                transition={{ delay: 0.4, y: { duration: 1.5, repeat: Infinity } }}
              >👑</motion.div>
            )}
            <div style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              border: `3px solid ${isVIP ? 'rgba(255,200,50,0.9)' : 'rgba(155,81,224,0.9)'}`,
              boxShadow: isVIP
                ? '0 0 20px rgba(255,180,30,0.9),0 0 40px rgba(255,100,255,0.5)'
                : '0 0 20px rgba(155,81,224,0.9)',
              flexShrink: 0,
            }}>
              {item.profilePicUrl
                ? <img src={item.profilePicUrl} alt={item.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,rgba(155,81,224,0.4),rgba(236,72,153,0.4))'}}>
                    <span style={{ color:'#fff',fontWeight:900,fontSize:28 }}>{(item.displayName||'?')[0].toUpperCase()}</span>
                  </div>
              }
            </div>
            {/* spinning ring */}
            <motion.div
              style={{
                position: 'absolute', inset: -4, borderRadius: '50%',
                border: `2px dashed ${isVIP ? 'rgba(255,200,50,0.5)' : 'rgba(155,81,224,0.5)'}`,
                pointerEvents: 'none',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {isVIP
                ? <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: 'linear-gradient(135deg,rgba(255,180,30,0.25),rgba(220,80,255,0.25))', color: 'rgba(255,210,80,0.9)', border: '1px solid rgba(255,200,50,0.3)' }}>✦ VIP เข้าห้อง ✦</span>
                : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(155,81,224,0.7)' }}>เข้าสู่ห้อง</span>
              }
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}>
              <h2 style={{
                fontWeight: 900, letterSpacing: '0.03em', lineHeight: 1, marginBottom: 8, fontSize: 'clamp(1.4rem,3vw,2rem)',
                background: isVIP
                  ? 'linear-gradient(135deg,#fff 0%,#ffd700 40%,#ff80ff 70%,#fff 100%)'
                  : 'linear-gradient(135deg,#ffffff,rgba(155,81,224,0.9))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: isVIP ? 'drop-shadow(0 0 12px rgba(255,200,50,0.8))' : 'drop-shadow(0 0 8px rgba(155,81,224,0.8))',
              }}>{item.displayName}</h2>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 12px', borderRadius: 99, fontSize: 14, fontWeight: 900,
                ...(isVIP
                  ? { background: 'linear-gradient(135deg,rgba(255,180,30,0.9),rgba(220,80,255,0.8))', color: '#fff', boxShadow: '0 0 14px rgba(255,180,30,0.8),0 0 28px rgba(220,80,255,0.4)', border: '1px solid rgba(255,220,80,0.4)' }
                  : { background: 'linear-gradient(135deg,rgba(155,81,224,0.9),rgba(236,72,153,0.7))', color: '#fff', boxShadow: '0 0 12px rgba(155,81,224,0.7)' })
              }}>
                {isVIP ? '⭐' : '🏅'} LV. {item.level || 0}
              </span>
              {isVIP && (
                <motion.span
                  style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,210,80,0.9)' }}
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >✨ ราชาผู้ยิ่งใหญ่ ✨</motion.span>
              )}
            </motion.div>
          </div>
        </div>

        {/* bottom shimmer */}
        <motion.div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
            background: isVIP
              ? 'linear-gradient(to right,transparent,rgba(255,200,50,0.8),rgba(255,80,255,0.8),transparent)'
              : 'linear-gradient(to right,transparent,rgba(155,81,224,0.6),transparent)',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <VIPParticles isVIP={isVIP} />
    </motion.div>
  );
}

function VIPParticles({ isVIP }) {
  const count  = isVIP ? 16 : 8;
  const colors = isVIP
    ? ['rgba(255,200,50,1)', 'rgba(255,100,255,1)', 'rgba(200,130,255,1)', 'rgba(255,255,150,1)']
    : ['rgba(155,81,224,1)', 'rgba(236,72,153,1)', 'rgba(200,150,255,1)'];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 3 }}>
      {[...Array(count)].map((_, i) => {
        const color = colors[i % colors.length];
        const size  = isVIP ? 4 + (i % 3) * 2 : 2 + (i % 3);
        const angle = (i / count) * 360;
        const dist  = 80 + (i % 4) * 30;
        const dx = Math.cos(angle * Math.PI / 180) * dist;
        const dy = Math.sin(angle * Math.PI / 180) * dist;
        return (
          <motion.div key={i}
            style={{ position: 'absolute', left: 60, top: 50, width: size, height: size, borderRadius: '50%', background: color, boxShadow: `0 0 ${size * 3}px ${color}` }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
            animate={{ x: [0, dx * 0.5, dx], y: [0, dy * 0.5 - 30, dy - 40], scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 1.5 + (i % 4) * 0.25, delay: 0.2 + (i % 5) * 0.1, repeat: Infinity, repeatDelay: (i % 3) * 0.7, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════
   Gift Card
════════════════════════════════════════ */
function GiftCard({ item, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ x: -400, opacity: 0, scale: 0.75 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: -400, opacity: 0, scale: 0.8, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{ position: 'relative', width: '100%', maxWidth: 500 }}
    >
      {/* pink outer glow */}
      <div style={{
        position: 'absolute', inset: -16, borderRadius: 24, pointerEvents: 'none',
        background: 'radial-gradient(ellipse,rgba(236,72,153,0.3) 0%,transparent 70%)',
        filter: 'blur(15px)', animation: 'divineBreath 1.8s ease-in-out infinite',
      }} />

      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16,
        border: '2px solid rgba(236,72,153,0.65)', backdropFilter: 'blur(24px)',
        background: 'linear-gradient(135deg,rgba(40,5,30,.97) 0%,rgba(60,10,45,.97) 100%)',
        boxShadow: '0 0 30px rgba(236,72,153,0.5),0 0 60px rgba(180,40,120,0.25),inset 0 1px 0 rgba(255,100,200,0.15)',
      }}>
        <motion.div
          style={{ position: 'absolute', top: 0, left: 0, height: 2, borderRadius: 99, background: 'linear-gradient(to right,transparent,rgba(255,80,180,1),rgba(255,150,255,1),transparent)' }}
          initial={{ width: '0%', left: '50%' }}
          animate={{ width: '100%', left: '0%' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1, backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)' }} />

        <div style={{ position: 'relative', padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(236,72,153,0.8)', boxShadow: '0 0 16px rgba(236,72,153,0.8),0 0 32px rgba(180,40,120,0.4)', flexShrink: 0 }}>
            {item.profilePicUrl
              ? <img src={item.profilePicUrl} alt={item.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(180,30,100,0.4)' }}>
                  <span style={{ color: '#ffaad4', fontWeight: 900, fontSize: 22 }}>{(item.displayName||'?')[0].toUpperCase()}</span>
                </div>
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(236,72,153,0.8)', marginBottom: 2 }}>🎁 ส่งของขวัญ</p>
            <h3 style={{ fontWeight: 900, fontSize: 20, lineHeight: 1, marginBottom: 8, background: 'linear-gradient(135deg,#fff,#ff80d0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 8px rgba(255,80,180,0.7))' }}>
              {item.displayName}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 14, fontWeight: 900, background: 'linear-gradient(135deg,rgba(236,72,153,0.9),rgba(180,40,120,0.9))', boxShadow: '0 0 12px rgba(236,72,153,0.7)', color: '#fff' }}>
                🎁 {item.giftName || 'ของขวัญ'}
              </span>
              {item.repeatCount > 1 && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 900, background: 'rgba(180,30,100,0.5)', color: '#ffaad4', border: '1px solid rgba(236,72,153,0.4)' }}>×{item.repeatCount}</span>}
              {item.diamonds > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,160,220,0.8)' }}>💎 {item.diamonds.toLocaleString()}</span>}
            </div>
          </div>
        </div>

        <motion.div
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(to right,transparent,rgba(255,80,180,0.7),transparent)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      </div>
      <GiftParticles />
    </motion.div>
  );
}

function GiftParticles() {
  const emojis = ['🎁','💎','✨','⭐','🌟','💫'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 3 }}>
      {[...Array(8)].map((_, i) => (
        <motion.div key={i}
          style={{ position: 'absolute', left: 40, top: 40, fontSize: 18 }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ x: (i % 2 === 0 ? 1 : -1) * (60 + i * 12), y: -(60 + i * 10), scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: (i % 2 === 0 ? 1 : -1) * 90 }}
          transition={{ duration: 1.2 + (i % 4) * 0.2, delay: 0.1 + i * 0.08, repeat: Infinity, repeatDelay: (i % 3) * 0.8, ease: 'easeOut' }}
        >{emojis[i % emojis.length]}</motion.div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   Screen flash
════════════════════════════════════════ */
function ScreenFlash({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="flash"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.3, 0] }}
          transition={{ duration: 0.6, times: [0, 0.1, 0.4, 1] }}
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40,
            background: 'radial-gradient(ellipse at center,rgba(255,200,50,0.5) 0%,rgba(200,80,255,0.3) 40%,transparent 70%)' }}
        />
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════
   Main Page
════════════════════════════════════════ */
export default function RoomEffectsPage() {
  const [queue, setQueue] = useState(IS_DEMO ? [DEMO_ITEM] : []);
  const [flash, setFlash] = useState(false);
  const uidRef = useRef(0);

  function makeUid() { return `${Date.now()}-${++uidRef.current}`; }

  useEffect(() => {
    /* join admin room */
    joinRoom();

    function onMember(data) {
      const level = data.level || 0;
      if (level < 1 && !IS_PREVIEW) {
        // show all joins even level 0 — comment this out to filter
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      setQueue(prev => addToQueue(prev, {
        _uid: makeUid(), variant: 'join',
        uniqueId: data.uniqueId,
        displayName: data.displayName || data.uniqueId || '?',
        profilePicUrl: data.profilePicUrl || null,
        level,
      }));
    }

    function onGift(data) {
      setQueue(prev => addToQueue(prev, {
        _uid: makeUid(), variant: 'gift',
        uniqueId: data.uniqueId,
        displayName: data.displayName || data.uniqueId || '?',
        profilePicUrl: data.profilePicUrl || null,
        giftName: data.giftName,
        repeatCount: data.repeatCount || 1,
        diamonds: data.diamonds || 0,
      }));
    }

    sock.on('tiktokMember', onMember);
    sock.on('tiktokGift',   onGift);
    return () => {
      sock.off('tiktokMember', onMember);
      sock.off('tiktokGift',   onGift);
    };
  }, []);

  function dismiss(uid) {
    setQueue(prev => prev.filter(q => q._uid !== uid));
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Noto Sans Thai', sans-serif; }
        html, body { width: 100%; height: 100%; background: ${IS_PREVIEW || IS_DEMO ? 'linear-gradient(135deg,#08000e 0%,#140025 40%,#0c0018 100%)' : 'transparent'}; overflow: hidden; }
        @keyframes divineBreath { 0%,100%{opacity:.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
      `}</style>

      <ScreenFlash show={flash} />

      {/* Preview header */}
      {IS_PREVIEW && (
        <div style={{ position: 'fixed', top: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
          <div style={{ background: 'rgba(10,0,20,.85)', border: '1px solid rgba(155,81,224,.35)', borderRadius: 12, padding: '8px 16px', backdropFilter: 'blur(12px)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(155,81,224,0.9)', letterSpacing: '0.15em' }}>👁 PREVIEW MODE</span>
            {ROOM_USER && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 10 }}>@{ROOM_USER}</span>}
          </div>
          <div style={{ background: 'rgba(10,0,20,.85)', border: '1px solid rgba(155,81,224,.25)', borderRadius: 10, padding: '6px 14px', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            OBS Browser Source — ไม่ต้องการ ?preview ใน URL จริง
          </div>
        </div>
      )}

      {/* Card stack — bottom-left */}
      <div style={{
        position: 'fixed', bottom: 32, left: 32,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 16, pointerEvents: 'none', zIndex: 50, maxWidth: 640,
      }}>
        <AnimatePresence>
          {queue.map(item =>
            item.variant === 'gift'
              ? <GiftCard key={item._uid} item={item} onDone={() => dismiss(item._uid)} />
              : <VIPJoinCard key={item._uid} item={item} onDone={() => dismiss(item._uid)} />
          )}
        </AnimatePresence>
      </div>

      {/* Empty state (preview only) */}
      {IS_PREVIEW && queue.length === 0 && (
        <div style={{
          position: 'fixed', bottom: 32, left: 32,
          background: 'rgba(10,0,20,.75)', border: '1px dashed rgba(155,81,224,.3)',
          borderRadius: 14, padding: '20px 28px', color: 'rgba(155,81,224,0.5)',
          fontSize: 14, fontWeight: 600, backdropFilter: 'blur(12px)',
        }}>
          🎭 รอคนเข้าห้อง... (preview)
        </div>
      )}
    </>
  );
}
