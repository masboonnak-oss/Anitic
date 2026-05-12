import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

/* ─────────────────────────────────────────
   URL-mode detection
   /roomeffects             → Dashboard
   /roomeffects?u=USERNAME  → OBS Overlay
   /roomeffects?demo        → Demo overlay
───────────────────────────────────────── */
const params     = new URLSearchParams(window.location.search);
const OVERLAY_USER = (params.get('u') || '').trim().replace(/^@/, '').toLowerCase();
const IS_OVERLAY   = Boolean(OVERLAY_USER) || params.has('demo');
const IS_DEMO      = params.has('demo');

export default function RoomEffectsPage() {
  return IS_OVERLAY ? <OverlayView /> : <DashboardView />;
}

/* ══════════════════════════════════════════════════════════
   ██████  DASHBOARD VIEW
══════════════════════════════════════════════════════════ */
function DashboardView() {
  const sockRef = useRef(null);
  const [username,    setUsername]    = useState(() => localStorage.getItem('re_lastUser') || '');
  const [status,      setStatus]      = useState('idle');
  const [errMsg,      setErrMsg]      = useState('');
  const [viewers,     setViewers]     = useState(0);
  const [likes,       setLikes]       = useState(0);
  const [diamonds,    setDiamonds]    = useState(0);
  const [copied,      setCopied]      = useState(false);
  const [overlayUser, setOverlayUser] = useState(() => localStorage.getItem('re_overlayUser') || '');
  const [navTab,      setNavTab]      = useState('dashboard');
  const [eventFilter, setEventFilter] = useState('all');
  const [visitors,    setVisitors]    = useState([]);
  const [visSort,     setVisSort]     = useState('last_seen');
  const [visLoading,  setVisLoading]  = useState(false);

  const feedRef  = useRef(null);
  const autoRef  = useRef(true);
  const [events, setEvents]   = useState([]);

  /* ── fetch visitors when tab opens or sort changes ── */
  useEffect(() => {
    if (navTab !== 'visitors') return;
    const u = username.trim().replace(/^@/, '');
    if (!u) return;
    setVisLoading(true);
    fetch(`/api/room-visitors/${encodeURIComponent(u)}?sort=${visSort}`)
      .then(r => r.json())
      .then(d => { setVisitors(d.visitors || []); })
      .catch(() => {})
      .finally(() => setVisLoading(false));
  }, [navTab, visSort, username]);
  const uidRef   = useRef(0);
  const mkid     = () => `${Date.now()}-${++uidRef.current}`;

  /* ── connect / disconnect ── */
  function connect() {
    const u = username.trim().replace(/^@/, '');
    if (!u) return;
    if (!sockRef.current) {
      sockRef.current = io('/', { transports: ['websocket', 'polling'] });
      wireSocket(sockRef.current);
    }
    setStatus('connecting'); setErrMsg('');
    localStorage.setItem('re_lastUser', u);
    sockRef.current.emit('setUniqueId', u, {});
  }
  function disconnect() {
    sockRef.current?.emit('disconnect_tiktok');
    setStatus('idle'); setViewers(0); setLikes(0); setDiamonds(0);
  }
  function sendTestKing() {
    const u = username.trim().replace(/^@/, '');
    if (!u) return;
    if (!sockRef.current) {
      sockRef.current = io('/', { transports: ['websocket', 'polling'] });
      wireSocket(sockRef.current);
    }
    sockRef.current.emit('testVIPEntry', { username: u });
  }

  /* ── socket wiring ── */
  function wireSocket(sock) {
    sock.on('tiktokConnected',    ()    => { setStatus('live'); setErrMsg(''); });
    sock.on('tiktokDisconnected', (msg) => { setStatus('error'); setErrMsg(msg || 'ตัดการเชื่อมต่อ'); });
    sock.on('tiktokReconnecting', (info) => {
      setStatus('connecting');
      const a = info?.attempt, m = info?.max, ms = info?.delayMs;
      setErrMsg(a ? `กำลังลองใหม่ ${a}/${m||5} (อีก ${Math.round((ms||2000)/1000)}s)` : 'กำลังเชื่อมต่อใหม่...');
    });
    sock.on('roomUser', d => { if (typeof d?.viewerCount === 'number') setViewers(d.viewerCount); });
    sock.on('like',     d => { if (typeof d?.totalLikeCount === 'number') setLikes(d.totalLikeCount); });

    const push = item => setEvents(prev => {
      const next = [...prev, item];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });

    sock.on('member', d => push({ id:mkid(), type:'join',   uniqueId:d.uniqueId||'?', displayName:d.displayName||d.uniqueId||'?', profilePicUrl:d.profilePicUrl||null, text:'เข้าร่วมห้อง', level:d.level||0 }));
    sock.on('chat',   d => push({ id:mkid(), type:'chat',   uniqueId:d.uniqueId,      displayName:d.displayName,                   profilePicUrl:d.profilePicUrl,        text:d.comment, level:d.level||0 }));
    sock.on('follow', d => push({ id:mkid(), type:'follow', uniqueId:d.uniqueId,      displayName:d.displayName,                   profilePicUrl:d.profilePicUrl,        text:'กดติดตาม', level:d.level||0 }));
    sock.on('share',  d => push({ id:mkid(), type:'share',  uniqueId:d.uniqueId,      displayName:d.displayName,                   profilePicUrl:d.profilePicUrl,        text:'แชร์ไลฟ์', level:d.level||0 }));
    sock.on('like',   d => { if (d?.likeCount > 0) push({ id:mkid(), type:'like', uniqueId:d.uniqueId||'?', displayName:d.displayName||'?', profilePicUrl:d.profilePicUrl||null, text:`ไลค์ ${d.likeCount} ครั้ง`, level:d.level||0 }); });
    sock.on('gift',   d => {
      if (d?._snapshot) {
        // snapshot จาก server หลัง reconnect — ตั้งยอดรวมตรงๆ ไม่บวกเพิ่ม
        setDiamonds(d.diamonds || 0);
        return;
      }
      setDiamonds(prev => prev + (d.diamonds || 0));
      push({ id:mkid(), type:'gift', uniqueId:d.uniqueId, displayName:d.displayName, profilePicUrl:d.profilePicUrl||null, text:`🎁 ${d.giftName||'ของขวัญ'}${d.repeatCount>1?' ×'+d.repeatCount:''}`, diamonds:d.diamonds||0, level:d.level||0 });
    });
  }

  /* auto-scroll */
  useEffect(() => {
    if (autoRef.current && feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  /* overlay URL */
  const overlayUrlUser = overlayUser.trim().replace(/^@/, '');
  const overlayUrl     = `${window.location.origin}/roomeffects?u=${overlayUrlUser}`;
  function copyOverlay() {
    if (!overlayUrlUser) return;
    navigator.clipboard.writeText(overlayUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }
  function saveOverlayUser(val) {
    const clean = val.replace(/^@/, '');
    setOverlayUser(clean);
    localStorage.setItem('re_overlayUser', clean);
  }

  const isLive   = status === 'live';
  const statDot  = { idle:'#444', connecting:'#f5a623', live:'#22c55e', error:'#ef4444' }[status];
  const statTxt  = { idle:'ไม่ได้เชื่อมต่อ', connecting:'กำลังเชื่อมต่อ...', live:'LIVE', error:'เชื่อมต่อไม่ได้' }[status];

  const FILTERS = [
    { key:'all',    label:'ทั้งหมด' },
    { key:'join',   label:'🚪 เข้าห้อง' },
    { key:'chat',   label:'💬 แชท' },
    { key:'gift',   label:'🎁 ของขวัญ' },
    { key:'like',   label:'❤️ ไลค์' },
    { key:'follow', label:'👑 ติดตาม' },
    { key:'share',  label:'📢 แชร์' },
  ];
  const TYPE_COLOR = { join:'#22d3ee', chat:'#c4b5fd', like:'#f472b6', follow:'#fbbf24', share:'#4ade80', gift:'#fb923c' };

  const filteredEvents = eventFilter === 'all' ? events : events.filter(e => e.type === eventFilter);

  /* ── stat cards data ── */
  const statCards = [
    { icon:'👁', label:'ผู้ชม',      value: viewers.toLocaleString(),         color:'#22d3ee' },
    { icon:'❤️', label:'ใจรวม',      value: likes.toLocaleString(),           color:'#f472b6' },
    { icon:'💎', label:'เพชร',       value: diamonds.toLocaleString(),        color:'#a78bfa' },
    { icon:'⚡', label:'Level สูง',  value: Math.max(0, ...events.filter(e=>e.level>0).map(e=>e.level)), color:'#fbbf24' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html, body { height:100%; background:#0b0b14; color:#e2e0f0; font-family:'Noto Sans Thai','Segoe UI',sans-serif; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(139,92,246,.3);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(139,92,246,.55)}
        @keyframes pulse-live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @keyframes kingPulse{0%{box-shadow:0 0 50px rgba(255,190,30,.7),0 0 100px rgba(220,80,255,.4)}50%{box-shadow:0 0 80px rgba(255,190,30,1),0 0 160px rgba(220,80,255,.7),0 0 240px rgba(255,130,0,.3)}100%{box-shadow:0 0 50px rgba(255,190,30,.7),0 0 100px rgba(220,80,255,.4)}}
        @keyframes lightningFlash{0%,100%{opacity:0}10%,30%{opacity:1}20%,40%{opacity:.3}}
        @keyframes ringOut{0%{transform:translate(-50%,-50%) scale(0);opacity:.8}100%{transform:translate(-50%,-50%) scale(4);opacity:0}}
        /* ─── Tokyo Gaming PRO aesthetic ─── */
        @keyframes tg-grid-pan{0%{background-position:0 0,0 0}100%{background-position:60px 60px,60px 60px}}
        @keyframes tg-scan{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes tg-emoji-rise{0%{transform:translateY(110vh) rotate(0deg);opacity:0}10%{opacity:.55}90%{opacity:.55}100%{transform:translateY(-15vh) rotate(360deg);opacity:0}}
        @keyframes tg-glow-pulse{0%,100%{box-shadow:0 0 24px -10px var(--gc,#a78bfa),inset 0 0 0 1px rgba(255,255,255,.04)}50%{box-shadow:0 0 40px -4px var(--gc,#a78bfa),inset 0 0 0 1px rgba(255,255,255,.1)}}
        @keyframes tg-aurora{0%{transform:translate(0,0) rotate(0deg) scale(1)}33%{transform:translate(8%,-4%) rotate(120deg) scale(1.1)}66%{transform:translate(-6%,6%) rotate(240deg) scale(.95)}100%{transform:translate(0,0) rotate(360deg) scale(1)}}
        @keyframes tg-holo{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes tg-rainbow-text{0%,100%{filter:hue-rotate(0deg)}50%{filter:hue-rotate(60deg)}}
        @keyframes tg-ring-pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.4);opacity:0}}
        @keyframes tg-counter-pop{0%{transform:scale(.6) translateY(8px);opacity:0;filter:blur(4px)}60%{transform:scale(1.18) translateY(-2px);filter:blur(0)}100%{transform:scale(1) translateY(0);opacity:1}}
        @keyframes tg-tab-glow{0%,100%{box-shadow:0 0 0 0 rgba(167,139,250,0)}50%{box-shadow:0 0 18px -2px rgba(167,139,250,.6)}}
        @keyframes tg-input-glow{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,0),inset 0 0 0 1px rgba(139,92,246,.25)}50%{box-shadow:0 0 24px -6px rgba(124,58,237,.55),inset 0 0 0 1px rgba(139,92,246,.5)}}
        @keyframes tg-icon-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-3px) rotate(-4deg)}}
        @keyframes tg-side-glow{0%,100%{box-shadow:inset 4px 0 0 -2px rgba(167,139,250,.4)}50%{box-shadow:inset 4px 0 0 -2px rgba(244,114,182,.7)}}
        @media (prefers-reduced-motion: reduce){
          .tg-aurora,.tg-grid,.tg-scanline,.tg-emoji,.re-stat-card,.re-stat-card::before,.re-connect-card::before,.re-page-title,.re-sidebar button.re-nav-active,.re-filter-pill.active,.re-connect-btn::after,.live-ring{animation:none!important}
          .re-stat-card:hover{transform:none}
        }
        .tg-bg{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
        .tg-grid{position:absolute;inset:-2px;background-image:linear-gradient(rgba(167,139,250,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(244,114,182,.07) 1px,transparent 1px);background-size:60px 60px;animation:tg-grid-pan 24s linear infinite;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 80%)}
        .tg-aurora{position:absolute;inset:-25%;background:conic-gradient(from 0deg at 50% 50%,rgba(244,114,182,.16) 0deg,transparent 60deg,rgba(34,211,238,.16) 120deg,transparent 180deg,rgba(167,139,250,.18) 240deg,transparent 300deg,rgba(244,114,182,.16) 360deg);animation:tg-aurora 32s ease-in-out infinite;filter:blur(60px);opacity:.7}
        .tg-glow1{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(244,114,182,.18),transparent 65%);top:-180px;right:-160px;filter:blur(40px)}
        .tg-glow2{position:absolute;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.14),transparent 65%);bottom:-220px;left:-160px;filter:blur(50px)}
        .tg-glow3{position:absolute;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.16),transparent 65%);top:40%;left:35%;filter:blur(60px)}
        .tg-scanline{position:absolute;inset:0 0 0 0;background:linear-gradient(180deg,transparent 0,rgba(167,139,250,.07) 50%,transparent 100%);height:120px;animation:tg-scan 8s linear infinite}
        .tg-emoji{position:absolute;font-size:18px;opacity:.55;animation:tg-emoji-rise linear infinite;text-shadow:0 0 12px currentColor;will-change:transform}
        /* ── HOLOGRAPHIC CARDS (stat cards + connect card) ── */
        .re-stat-card{position:relative;transition:transform .25s cubic-bezier(.2,.8,.3,1.2),box-shadow .25s;animation:tg-glow-pulse 3.6s ease-in-out infinite;overflow:hidden}
        .re-stat-card::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(120deg,var(--gc,#a78bfa) 0%,#22d3ee 25%,#f472b6 50%,#fbbf24 75%,var(--gc,#a78bfa) 100%);background-size:300% 100%;animation:tg-holo 6s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.55;pointer-events:none}
        .re-stat-card::after{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.06),transparent 50%);pointer-events:none}
        .re-stat-card:hover{transform:translateY(-4px) scale(1.03) rotate(-.5deg)}
        .re-stat-card:hover::before{opacity:1}
        .re-stat-card:hover .re-stat-icon{animation:tg-icon-float 1.2s ease-in-out infinite}
        .re-stat-val{animation:tg-counter-pop .5s cubic-bezier(.2,.8,.3,1.2)}
        /* ── CONNECT CARD holo border ── */
        .re-connect-card{position:relative;overflow:hidden}
        .re-connect-card::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(120deg,#7c3aed 0%,#22d3ee 30%,#f472b6 60%,#fbbf24 100%);background-size:300% 100%;animation:tg-holo 8s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.6;pointer-events:none}
        .re-connect-card input:focus{animation:tg-input-glow 2s ease-in-out infinite}
        /* ── PAGE HEADER gradient text ── */
        .re-page-title{background:linear-gradient(120deg,#fff 0%,#c4b5fd 35%,#f472b6 65%,#fff 100%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:tg-holo 6s linear infinite;filter:drop-shadow(0 0 24px rgba(167,139,250,.35))}
        /* ── SIDEBAR active glow ── */
        .re-sidebar{position:relative}
        .re-sidebar button.re-nav-active{position:relative;animation:tg-side-glow 2.6s ease-in-out infinite}
        /* ── EVENT ROW hover lift ── */
        .re-event-row{transition:background .15s,transform .15s,box-shadow .15s}
        .re-event-row:hover{background:linear-gradient(90deg,rgba(139,92,246,.12),rgba(244,114,182,.04))!important;transform:translateX(2px);box-shadow:inset 3px 0 0 rgba(244,114,182,.65)}
        /* ── LIVE indicator multi-ring ── */
        .live-ring{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(34,197,94,.6);animation:tg-ring-pulse 1.6s ease-out infinite}
        .live-ring.r2{animation-delay:.5s}
        /* ── Filter pill hover ── */
        .re-filter-pill{transition:all .15s;position:relative}
        .re-filter-pill:hover{transform:translateY(-1px);box-shadow:0 4px 14px -6px rgba(167,139,250,.6)}
        .re-filter-pill.active{animation:tg-tab-glow 2.4s ease-in-out infinite}
        /* ── Connect button hot ── */
        .re-connect-btn{position:relative;overflow:hidden}
        .re-connect-btn::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:np-sweep 2.2s ease-in-out infinite}
        input::placeholder{color:rgba(180,160,230,.35)}
        input:focus{outline:none}
        .re-sidebar{width:156px;flex-shrink:0}
        .re-page-header{padding:20px 28px 0;flex-shrink:0}
        .re-dash-content{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:16px 28px 20px}
        .re-settings-content{flex:1;overflow:auto;padding:20px 28px}
        .re-top-row{display:flex;gap:14px;flex-shrink:0;margin-bottom:16px;flex-wrap:wrap}
        .re-stat-card{flex:0 0 130px}
        .re-connect-card{flex:1 1 360px;min-width:0}
        .re-vis-grid{display:grid;grid-template-columns:2.8fr 0.6fr 0.8fr 0.8fr 0.8fr;gap:0}
        /* iPad / tablet (≤1100px): connect card เต็มแถว, stat cards 4 ใบกางเต็ม */
        @media(max-width:1100px){
          .re-sidebar{width:60px}
          .re-logo-text,.re-nav-label,.re-status-text{display:none}
          .re-page-header{padding:16px 18px 0}
          .re-dash-content{padding:12px 16px 14px}
          .re-settings-content{padding:14px 18px}
          .re-connect-card{flex:1 1 100%}
          .re-stat-card{flex:1 1 calc(25% - 11px);min-width:120px}
        }
        /* มือถือ (≤640px): 2x2 stat cards, ตารางผู้เยี่ยมชมซ่อน column รอง */
        @media(max-width:640px){
          .re-sidebar{width:50px}
          .re-page-header{padding:12px 12px 0}
          .re-dash-content{padding:10px 10px 12px}
          .re-settings-content{padding:12px}
          .re-stat-card{flex:1 1 calc(50% - 7px);min-width:0;padding:12px 14px !important}
          .re-stat-card .re-stat-val{font-size:18px !important}
          .re-vis-grid{grid-template-columns:2.4fr 0.7fr 0.9fr !important}
          .re-vis-hide-sm{display:none !important}
          .re-podium{flex-direction:column !important}
          .re-podium > *{width:100% !important}
        }
      `}</style>

      {/* ─── Tokyo Gaming PRO animated background ─── */}
      <div className="tg-bg" aria-hidden>
        <div className="tg-aurora" />
        <div className="tg-grid" />
        <div className="tg-glow1" />
        <div className="tg-glow2" />
        <div className="tg-glow3" />
        <div className="tg-scanline" />
        {(() => {
          const ems = ['✦','⚡','💎','❤️','🎮','✨','★','💜'];
          const items = [];
          for (let i = 0; i < 14; i++) {
            const e = ems[i % ems.length];
            const left = (7 + (i * 6.7) % 92).toFixed(1) + '%';
            const dur = (14 + (i * 1.7) % 12).toFixed(1) + 's';
            const delay = ((i * 1.3) % 12).toFixed(1) + 's';
            const sz = 14 + (i % 4) * 4;
            const color = ['#f472b6','#a78bfa','#22d3ee','#fbbf24'][i % 4];
            items.push(<span key={i} className="tg-emoji" style={{ left, fontSize:sz, color, animationDuration:dur, animationDelay:delay }}>{e}</span>);
          }
          return items;
        })()}
      </div>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden', position:'relative', zIndex:1 }}>

        {/* ══ SIDEBAR ══ */}
        <aside className="re-sidebar" style={{ background:'rgba(15,14,26,.85)', backdropFilter:'blur(10px)', borderRight:'1px solid rgba(139,92,246,.18)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* logo */}
          <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(139,92,246,.1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🎮</div>
              <span className="re-logo-text" style={{ fontWeight:900, fontSize:14, letterSpacing:'0.1em', color:'#e2e0ff' }}>ROOM FX</span>
            </div>
          </div>
          {/* nav */}
          <nav style={{ flex:1, padding:'12px 8px' }}>
            {[
              { id:'dashboard', icon:'⊞', label:'แดชบอร์ด' },
              { id:'visitors',  icon:'👥', label:'ผู้เยี่ยมชม' },
              { id:'settings',  icon:'⚙', label:'การตั้งค่า' },
            ].map(item => (
              <button key={item.id} onClick={() => setNavTab(item.id)}
                className={navTab===item.id?'re-nav-active':''}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, border:'none', cursor:'pointer', marginBottom:4, transition:'all .2s',
                  background: navTab===item.id ? 'linear-gradient(90deg,rgba(139,92,246,.28),rgba(244,114,182,.1))' : 'transparent',
                  color: navTab===item.id ? '#e9d5ff' : 'rgba(160,150,200,.55)',
                  fontWeight: navTab===item.id ? 800 : 500, fontSize:13 }}>
                <span style={{ fontSize:14 }}>{item.icon}</span>
                <span className="re-nav-label">{item.label}</span>
                {navTab===item.id && <span style={{ marginLeft:'auto', width:4, height:4, borderRadius:'50%', background:'#a78bfa', flexShrink:0 }} />}
              </button>
            ))}
          </nav>
          {/* back to leaderboard */}
          <div style={{ padding:'8px 8px 0' }}>
            <button onClick={() => window.location.href = '/'}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:7, padding:'8px 10px', borderRadius:8, border:'1px solid rgba(139,92,246,.15)', background:'rgba(139,92,246,.07)', cursor:'pointer', transition:'all .15s', color:'rgba(160,150,200,.6)', fontSize:12, fontWeight:600 }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(139,92,246,.18)';e.currentTarget.style.color='#c4b5fd';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(139,92,246,.07)';e.currentTarget.style.color='rgba(160,150,200,.6)';}}>
              <span style={{ fontSize:13 }}>←</span>
              <span className="re-nav-label">หน้าหลัก</span>
            </button>
          </div>
          {/* server status */}
          <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(139,92,246,.1)', marginTop:8, display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ position:'relative', width:9, height:9, flexShrink:0 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background: statDot, boxShadow: isLive?`0 0 12px ${statDot}`:'none', animation: isLive?'pulse-live 1.8s infinite':undefined }} />
              {isLive && <><div className="live-ring" /><div className="live-ring r2" /></>}
            </div>
            <span className="re-status-text" style={{ fontSize:11, color:'rgba(160,150,200,.6)', lineHeight:1.3, fontWeight:600 }}>{isLive ? 'LIVE • เชื่อมต่อแล้ว' : statTxt}</span>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'rgba(11,11,20,.55)' }}>

          {/* ─ page header ─ */}
          <div className="re-page-header">
            <div className="re-page-title" style={{ fontSize:28, fontWeight:900, letterSpacing:'0.08em', display:'inline-block' }}>
              {navTab === 'dashboard' ? 'DASHBOARD' : navTab === 'visitors' ? 'ผู้เยี่ยมชม' : 'การตั้งค่า'}
            </div>
            <div style={{ fontSize:12, color:'rgba(180,170,220,.6)', marginTop:4, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: isLive?'#22c55e':'rgba(167,139,250,.5)', boxShadow: isLive?'0 0 8px #22c55e':'none' }} />
              {navTab === 'dashboard' ? 'ควบคุม TikTok LIVE แบบเรียลไทม์' : navTab === 'visitors' ? 'บันทึกชื่อ รูป เลเวล ใจ และเพชรของผู้ชม' : 'ตั้งค่า Overlay สำหรับ OBS / TikTok Live Studio'}
            </div>
          </div>

          {/* ─ DASHBOARD TAB ─ */}
          {navTab === 'dashboard' && (
            <div className="re-dash-content">

              {/* top row: connect card + stat cards */}
              <div className="re-top-row">

                {/* connect card */}
                <div className="re-connect-card" style={{ background:'#16152a', border:'1px solid rgba(139,92,246,.18)', borderRadius:14, padding:'20px 22px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                    <span style={{ fontSize:15 }}>📡</span>
                    <span style={{ fontWeight:700, fontSize:14, color:'#c4b5fd' }}>การเชื่อมต่อ TikTok LIVE</span>
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <div style={{ position:'relative', flex:'1 1 160px' }}>
                      <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(139,92,246,.8)', fontWeight:700, fontSize:15 }}>@</span>
                      <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        onKeyDown={e => e.key==='Enter' && (status==='idle'||status==='error') && connect()}
                        placeholder="TikTok Username ของคนที่ไลฟ์..."
                        disabled={status==='connecting'||status==='live'}
                        style={{ width:'100%', background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.25)', borderRadius:10, color:'#e2e0ff', padding:'11px 14px 11px 32px', fontSize:14 }}
                      />
                    </div>
                    {status==='idle'||status==='error' ? (
                      <button className="re-connect-btn" onClick={connect} disabled={!username.trim()} style={{ background:'linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%)', border:'none', borderRadius:10, color:'#fff', padding:'11px 26px', fontSize:14, fontWeight:800, cursor:'pointer', opacity:username.trim()?1:.45, display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap', boxShadow:'0 8px 24px -8px rgba(168,85,247,.65)', letterSpacing:'.04em' }}>
                        ▶ &nbsp;เชื่อมต่อ
                      </button>
                    ) : status==='connecting' ? (
                      <button disabled style={{ background:'rgba(245,166,35,.1)', border:'1px solid rgba(245,166,35,.35)', borderRadius:10, color:'#f5a623', padding:'11px 24px', fontSize:14, fontWeight:700, cursor:'not-allowed' }}>
                        ⏳ กำลังเชื่อมต่อ...
                      </button>
                    ) : (
                      <button onClick={disconnect} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.35)', borderRadius:10, color:'#ef4444', padding:'11px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                        ⏹ ตัดการเชื่อมต่อ
                      </button>
                    )}
                  </div>
                  {errMsg && <div style={{ marginTop:8, fontSize:12, color:'#ef4444' }}>⚠️ {errMsg}</div>}
                  <div style={{ marginTop:14, borderTop:'1px solid rgba(139,92,246,.12)', paddingTop:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'rgba(160,150,200,.4)', fontWeight:600 }}>ทดสอบ Effect บน Overlay</span>
                    <button onClick={sendTestKing} disabled={!username.trim()}
                      style={{ background: username.trim() ? 'linear-gradient(135deg,rgba(255,180,30,.25),rgba(220,80,255,.25))' : 'rgba(255,255,255,.04)',
                        border:`1px solid ${username.trim()?'rgba(255,200,50,.5)':'rgba(255,255,255,.08)'}`,
                        borderRadius:10, color: username.trim() ? 'rgba(255,210,80,.95)' : 'rgba(160,150,200,.3)',
                        padding:'8px 18px', fontSize:13, fontWeight:700, cursor: username.trim() ? 'pointer' : 'not-allowed',
                        transition:'all .2s', display:'flex', alignItems:'center', gap:7 }}>
                      👑 ทดสอบ KING Effect
                    </button>
                  </div>
                </div>

                {/* stat cards */}
                {statCards.map(s => (
                  <div key={s.label} className="re-stat-card" style={{ background:'linear-gradient(155deg,rgba(22,21,42,.92) 0%,rgba(28,18,48,.92) 100%)', backdropFilter:'blur(10px)', border:`1px solid ${s.color}33`, borderRadius:14, padding:'16px 18px', display:'flex', flexDirection:'column', justifyContent:'space-between', gap:14, minHeight:120, '--gc': s.color }}>
                    <div className="re-stat-icon" style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${s.color}33,${s.color}11)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:`0 0 18px -6px ${s.color}88, inset 0 1px 0 rgba(255,255,255,.08)` }}>{s.icon}</div>
                    <div>
                      <div key={String(s.value)} className="re-stat-val" style={{ fontSize:24, fontWeight:900, color:s.color, lineHeight:1, marginBottom:4, textShadow:`0 0 22px ${s.color}55`, letterSpacing:'-.01em' }}>{s.value}</div>
                      <div style={{ fontSize:11, color:'rgba(160,150,200,.55)', fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* event feed */}
              <div style={{ flex:1, minHeight:0, background:'#16152a', border:'1px solid rgba(139,92,246,.14)', borderRadius:14, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {/* feed header */}
                <div style={{ padding:'12px 18px', borderBottom:'1px solid rgba(139,92,246,.1)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>⚡</span>
                    <span style={{ fontWeight:700, fontSize:13, color:'#c4b5fd' }}>เหตุการณ์แบบเรียลไทม์</span>
                  </div>
                  <button onClick={() => setEvents([])} style={{ background:'transparent', border:'1px solid rgba(139,92,246,.2)', borderRadius:6, color:'rgba(160,150,200,.5)', fontSize:11, padding:'3px 10px', cursor:'pointer' }}>ล้าง</button>
                </div>
                {/* filter tabs */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(139,92,246,.08)', display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
                  {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setEventFilter(f.key)}
                      className={`re-filter-pill ${eventFilter===f.key?'active':''}`}
                      style={{ background: eventFilter===f.key ? 'linear-gradient(135deg,rgba(139,92,246,.32),rgba(244,114,182,.18))' : 'rgba(139,92,246,.06)', border:`1px solid ${eventFilter===f.key?'rgba(167,139,250,.6)':'rgba(139,92,246,.12)'}`, borderRadius:20, color: eventFilter===f.key?'#e9d5ff':'rgba(160,150,200,.55)', fontSize:12, fontWeight:700, padding:'4px 12px', cursor:'pointer', whiteSpace:'nowrap' }}>
                      {f.label}
                      {f.key !== 'all' && <span style={{ marginLeft:4, opacity:.6 }}>({events.filter(e=>e.type===f.key).length})</span>}
                    </button>
                  ))}
                </div>
                {/* event list */}
                <div ref={feedRef} style={{ flex:1, overflowY:'auto', padding:'6px 10px 10px' }}
                  onScroll={e => { const el = e.target; autoRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
                  {filteredEvents.length === 0 ? (
                    <div style={{ padding:'48px 16px', textAlign:'center' }}>
                      <div style={{ fontSize:32, marginBottom:12, opacity:.25 }}>⚡</div>
                      <div style={{ fontSize:13, color:'rgba(160,150,200,.35)', fontWeight:600 }}>ยังไม่มีเหตุการณ์</div>
                      <div style={{ fontSize:12, color:'rgba(160,150,200,.25)', marginTop:4 }}>เชื่อมต่อ TikTok LIVE เพื่อเริ่มต้นกัน</div>
                    </div>
                  ) : filteredEvents.map(item => (
                    <div key={item.id} className="re-event-row" style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:8, marginBottom:2 }}>
                      {/* avatar */}
                      {item.profilePicUrl
                        ? <img src={item.profilePicUrl} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:`1.5px solid ${TYPE_COLOR[item.type]||'#444'}55` }} onError={e=>e.target.style.display='none'} />
                        : <div style={{ width:28, height:28, borderRadius:'50%', background:`${TYPE_COLOR[item.type]||'#555'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0, color:TYPE_COLOR[item.type]||'#aaa', fontWeight:700 }}>{(item.displayName||'?')[0].toUpperCase()}</div>
                      }
                      {/* name + text */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'rgba(200,190,255,.85)', marginRight:6 }}>{item.displayName||item.uniqueId}</span>
                        <span style={{ fontSize:13, color: TYPE_COLOR[item.type]||'#aaa' }}>{item.text}</span>
                        {item.diamonds > 0 && <span style={{ marginLeft:6, fontSize:11, color:'rgba(167,139,250,.7)' }}>💎 {item.diamonds.toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─ VISITORS TAB ─ */}
          {navTab === 'visitors' && (
            <div className="re-dash-content" style={{ display:'flex', flexDirection:'column', gap:14, height:'100%', overflow:'hidden' }}>

              {/* ⭐ Top 3 ผู้ส่งเพชรสูงสุด — เก็บไว้ทำเอฟเฟกต์เข้าห้องในอนาคต */}
              {(() => {
                const top3 = [...visitors].filter(v => (v.total_diamonds||0) > 0).sort((a,b) => (b.total_diamonds||0) - (a.total_diamonds||0)).slice(0,3);
                if (top3.length === 0) return null;
                const podiumStyle = [
                  { rank:'#1', emoji:'🥇', g1:'#ffe14a', g2:'#ff9100', glow:'rgba(255,200,50,.5)' },
                  { rank:'#2', emoji:'🥈', g1:'#e2e8f0', g2:'#94a3b8', glow:'rgba(200,210,235,.4)' },
                  { rank:'#3', emoji:'🥉', g1:'#fbbf77', g2:'#b45309', glow:'rgba(220,140,60,.4)' },
                ];
                return (
                  <div style={{ background:'linear-gradient(135deg,rgba(40,20,60,.6),rgba(20,10,40,.6))', border:'1px solid rgba(255,200,80,.2)', borderRadius:14, padding:'14px 16px', flexShrink:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15 }}>👑</span>
                      <span style={{ fontWeight:800, fontSize:13, color:'rgba(255,210,80,.9)', letterSpacing:'.06em' }}>TOP 3 ผู้ส่งเพชรสูงสุด</span>
                      <span style={{ fontSize:11, color:'rgba(160,150,200,.45)' }}>(เอฟเฟกต์เข้าห้องพิเศษบน Overlay)</span>
                      <div style={{ flex:1 }} />
                      <button onClick={async () => {
                        const u = username.trim().replace(/^@/,'');
                        if (!u || !window.confirm(`รีเซ็ตลำดับผู้ส่งเพชรของ @${u}? (ไม่ลบ visitor)`)) return;
                        await fetch(`/api/room-visitors/${encodeURIComponent(u)}/diamonds`, { method:'DELETE' });
                        setVisitors(prev => prev.map(v => ({ ...v, total_diamonds: 0 })));
                      }} style={{ background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.4)', borderRadius:8, color:'rgba(251,191,36,.95)', fontSize:11, fontWeight:700, padding:'4px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
                        🔄 ล้างลำดับเพชร
                      </button>
                    </div>
                    <div className="re-podium" style={{ display:'flex', gap:10 }}>
                      {top3.map((v, i) => {
                        const ps = podiumStyle[i];
                        return (
                          <div key={v.unique_id} style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:10, background:'rgba(0,0,0,.28)', border:`1px solid ${ps.glow}`, borderRadius:12, padding:'10px 12px', boxShadow:`0 0 18px -8px ${ps.glow}` }}>
                            <div style={{ fontSize:20, lineHeight:1, filter:`drop-shadow(0 0 6px ${ps.glow})`, flexShrink:0 }}>{ps.emoji}</div>
                            {v.profile_pic_url
                              ? <img src={v.profile_pic_url} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:`2px solid ${ps.g1}`, flexShrink:0 }} onError={e=>{e.target.style.display='none'}} />
                              : <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${ps.g1},${ps.g2})`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#1a1030', fontSize:14, flexShrink:0 }}>{(v.display_name||v.unique_id||'?')[0].toUpperCase()}</div>
                            }
                            <div style={{ minWidth:0, flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.display_name || v.unique_id}</div>
                              <div style={{ fontSize:12, fontWeight:700, color:ps.g1, marginTop:2 }}>💎 {(v.total_diamonds||0).toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* controls row */}
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', flexShrink:0 }}>
                {/* sort pills */}
                {[
                  { key:'last_seen',  label:'ล่าสุด' },
                  { key:'diamonds',   label:'💎 เพชร' },
                  { key:'likes',      label:'❤️ ใจ' },
                  { key:'level',      label:'⭐ เลเวล' },
                  { key:'first_seen', label:'แรกสุด' },
                ].map(s => (
                  <button key={s.key} onClick={() => setVisSort(s.key)}
                    style={{ background: visSort===s.key ? 'rgba(139,92,246,.22)' : 'rgba(139,92,246,.06)',
                      border:`1px solid ${visSort===s.key?'rgba(139,92,246,.5)':'rgba(139,92,246,.12)'}`,
                      borderRadius:20, color: visSort===s.key?'#c4b5fd':'rgba(160,150,200,.5)',
                      fontSize:12, fontWeight:600, padding:'5px 13px', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}>
                    {s.label}
                  </button>
                ))}
                <div style={{ flex:1 }} />
                <span style={{ fontSize:12, color:'rgba(160,150,200,.4)' }}>
                  {visitors.length} คน
                </span>
                <button onClick={async () => {
                  const u = username.trim().replace(/^@/,'');
                  if (!u || !window.confirm(`ลบข้อมูลผู้เยี่ยมชมทั้งหมดของ @${u}?`)) return;
                  await fetch(`/api/room-visitors/${encodeURIComponent(u)}`, { method:'DELETE' });
                  setVisitors([]);
                }} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8,
                  color:'rgba(239,68,68,.8)', fontSize:12, fontWeight:600, padding:'5px 12px', cursor:'pointer' }}>
                  🗑 ล้างทั้งหมด
                </button>
              </div>

              {/* table */}
              <div style={{ flex:1, minHeight:0, background:'#16152a', border:'1px solid rgba(139,92,246,.14)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                {/* header row */}
                <div className="re-vis-grid" style={{ padding:'10px 16px', borderBottom:'1px solid rgba(139,92,246,.1)', flexShrink:0 }}>
                  {['ชื่อ / username','เลเวล','❤️ ใจ','💎 เพชร','เข้าล่าสุด'].map((h,i) => (
                    <span key={i} className={(i===1||i===4)?'re-vis-hide-sm':''} style={{ fontSize:11, fontWeight:700, color:'rgba(160,150,200,.45)', letterSpacing:'.05em', textAlign: i===0?'left':'right' }}>{h}</span>
                  ))}
                </div>

                {/* rows */}
                <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
                  {visLoading ? (
                    <div style={{ padding:'48px 0', textAlign:'center', color:'rgba(160,150,200,.35)', fontSize:13 }}>
                      <div style={{ fontSize:28, marginBottom:10, opacity:.3 }}>👥</div>กำลังโหลด...
                    </div>
                  ) : !username.trim() ? (
                    <div style={{ padding:'48px 0', textAlign:'center', color:'rgba(160,150,200,.3)', fontSize:13 }}>
                      <div style={{ fontSize:28, marginBottom:10, opacity:.25 }}>👥</div>ใส่ TikTok Username ในแดชบอร์ดก่อน
                    </div>
                  ) : visitors.length === 0 ? (
                    <div style={{ padding:'48px 0', textAlign:'center', color:'rgba(160,150,200,.3)', fontSize:13 }}>
                      <div style={{ fontSize:28, marginBottom:10, opacity:.25 }}>👥</div>ยังไม่มีข้อมูล — เปิด TikTok LIVE แล้วเชื่อมต่อก่อน
                    </div>
                  ) : visitors.map((v, idx) => {
                    const lastSeen = v.last_seen ? new Date(v.last_seen) : null;
                    const timeStr  = lastSeen ? lastSeen.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : '—';
                    const isKing   = (v.level || 0) >= 20;
                    return (
                      <div key={v.unique_id} className="re-vis-grid"
                        style={{ padding:'7px 16px', borderBottom:'1px solid rgba(139,92,246,.05)', transition:'background .1s',
                          background: idx%2===0 ? 'transparent' : 'rgba(139,92,246,.025)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(139,92,246,.07)'}
                        onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?'transparent':'rgba(139,92,246,.025)'}>

                        {/* avatar + name */}
                        <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                          <div style={{ position:'relative', flexShrink:0 }}>
                            {v.profile_pic_url
                              ? <img src={v.profile_pic_url} alt="" style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover',
                                  border:`2px solid ${isKing?'rgba(255,200,50,.7)':'rgba(139,92,246,.4)'}` }}
                                  onError={e=>{e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
                              : null
                            }
                            <div style={{ width:34, height:34, borderRadius:'50%', display: v.profile_pic_url ? 'none' : 'flex',
                              alignItems:'center', justifyContent:'center', flexShrink:0,
                              background: isKing ? 'linear-gradient(135deg,rgba(200,120,20,.5),rgba(180,40,180,.4))' : 'rgba(139,92,246,.2)',
                              border:`2px solid ${isKing?'rgba(255,200,50,.5)':'rgba(139,92,246,.3)'}`,
                              color: isKing ? '#ffd700' : '#a78bfa', fontWeight:900, fontSize:14 }}>
                              {(v.display_name||v.unique_id||'?')[0].toUpperCase()}
                            </div>
                            {isKing && <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', fontSize:10 }}>👑</div>}
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:13, color: isKing ? 'rgba(255,210,80,.95)' : 'rgba(200,190,255,.85)',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {v.display_name || v.unique_id}
                            </div>
                            <div style={{ fontSize:10, color:'rgba(160,150,200,.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              @{v.unique_id}
                            </div>
                          </div>
                        </div>

                        {/* level */}
                        <div className="re-vis-hide-sm" style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
                          <span style={{ padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:700,
                            background: isKing ? 'linear-gradient(135deg,rgba(255,180,30,.25),rgba(220,80,255,.2))' : 'rgba(139,92,246,.15)',
                            color: isKing ? 'rgba(255,210,80,.9)' : 'rgba(167,139,250,.8)',
                            border: `1px solid ${isKing?'rgba(255,200,50,.3)':'rgba(139,92,246,.2)'}` }}>
                            {v.level||0}
                          </span>
                        </div>

                        {/* likes */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', fontSize:13, fontWeight:700,
                          color: v.total_likes > 0 ? 'rgba(239,68,68,.8)' : 'rgba(160,150,200,.3)' }}>
                          {v.total_likes > 0 ? `❤️ ${v.total_likes.toLocaleString()}` : '—'}
                        </div>

                        {/* diamonds */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', fontSize:13, fontWeight:700,
                          color: v.total_diamonds > 0 ? 'rgba(167,139,250,.9)' : 'rgba(160,150,200,.3)' }}>
                          {v.total_diamonds > 0 ? `💎 ${v.total_diamonds.toLocaleString()}` : '—'}
                        </div>

                        {/* last seen */}
                        <div className="re-vis-hide-sm" style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', fontSize:11, color:'rgba(160,150,200,.4)' }}>
                          {timeStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─ SETTINGS TAB ─ */}
          {navTab === 'settings' && (
            <div className="re-settings-content">
              <div style={{ background:'#16152a', border:'1px solid rgba(139,92,246,.18)', borderRadius:14, padding:'22px 24px', maxWidth:640 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:18 }}>
                  <span style={{ fontSize:17 }}>🎬</span>
                  <span style={{ fontWeight:700, fontSize:15, color:'#c4b5fd' }}>Overlay URL สำหรับ OBS / TikTok Live Studio</span>
                </div>
                <div style={{ fontSize:13, color:'rgba(160,150,200,.55)', marginBottom:16, lineHeight:1.6 }}>
                  ใส่ TikTok username แล้วก็อปปี้ URL ไปวางใน Browser Source ของ TikTok Live Studio หรือ OBS ได้เลย
                </div>
                {/* overlay username input */}
                <label style={{ fontSize:12, color:'rgba(160,150,200,.6)', fontWeight:600, display:'block', marginBottom:6 }}>TikTok Username สำหรับ Overlay</label>
                <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                  <div style={{ position:'relative', flex:1 }}>
                    <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(139,92,246,.7)', fontWeight:700, fontSize:15 }}>@</span>
                    <input
                      value={overlayUser}
                      onChange={e => saveOverlayUser(e.target.value)}
                      placeholder="tiktok_username"
                      style={{ width:'100%', background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.25)', borderRadius:10, color:'#e2e0ff', padding:'10px 14px 10px 32px', fontSize:14 }}
                    />
                  </div>
                </div>
                {/* URL display */}
                {overlayUrlUser ? (
                  <>
                    <label style={{ fontSize:12, color:'rgba(160,150,200,.6)', fontWeight:600, display:'block', marginBottom:6 }}>Overlay URL</label>
                    <div style={{ background:'rgba(0,0,0,.35)', border:'1px solid rgba(139,92,246,.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#a78bfa', fontFamily:'monospace', wordBreak:'break-all', marginBottom:14 }}>
                      {overlayUrl}
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={copyOverlay} style={{ background: copied?'rgba(34,197,94,.15)':'rgba(139,92,246,.15)', border:`1px solid ${copied?'rgba(34,197,94,.5)':'rgba(139,92,246,.4)'}`, borderRadius:10, color: copied?'#4ade80':'#a78bfa', padding:'10px 22px', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .2s' }}>
                        {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอก URL'}
                      </button>
                      <a href={`${overlayUrl}&preview`} target="_blank" rel="noreferrer"
                        style={{ background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.2)', borderRadius:10, color:'rgba(160,150,200,.6)', padding:'10px 18px', fontSize:13, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center' }}>
                        ↗ ดูตัวอย่าง
                      </a>
                    </div>
                  </>
                ) : (
                  <div style={{ padding:'16px', background:'rgba(139,92,246,.05)', border:'1px dashed rgba(139,92,246,.2)', borderRadius:10, fontSize:13, color:'rgba(160,150,200,.4)', textAlign:'center' }}>
                    ← ใส่ username ก่อนเพื่อสร้าง URL
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}


/* ══════════════════════════════════════════════════════════
   ██████  OVERLAY VIEW  (OBS / TikTok Live Studio)
══════════════════════════════════════════════════════════ */

/* ── passive socket for overlay — joins room, does NOT connect TikTok itself ── */
const overlaySock = IS_OVERLAY ? io('/', { transports: ['websocket','polling'] }) : null;
if (overlaySock && OVERLAY_USER) {
  const joinFn = () => overlaySock.emit('joinRoom', { username: OVERLAY_USER });
  overlaySock.on('connect', joinFn);
  if (overlaySock.connected) joinFn();
}

/* ── demo item — รับ ?demo=N เพื่อทดสอบ tier ระดับใดก็ได้ ── */
const DEMO_LEVEL = (() => {
  const v = params.get('demo');
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 30;
})();
const DEMO_ITEM = { _uid:'demo-1', variant:'join', uniqueId:'babynoey',
  displayName: DEMO_LEVEL >= 30 ? 'BabyNoey ⚜️' : DEMO_LEVEL >= 20 ? 'BabyNoey 👑' : DEMO_LEVEL >= 15 ? 'BabyNoey ★' : DEMO_LEVEL >= 5 ? 'BabyNoey' : 'Newbie',
  profilePicUrl:null, level: DEMO_LEVEL };


/* ══════════════════════════════════════════════════════════
   ██████  OVERLAY VIEW  (OBS / TikTok Live Studio)
   นโยบาย: แค่ "ป้ายชื่อ" สวยๆ ตอนคนเข้าห้อง
            — ไม่โชว์รูป / ไม่โชว์ level / ไม่เรียง tier
            — เน้นทอง+รุ้ง อลังการพอดี ไม่ใหญ่เกิน
            — server ยังจำของขวัญ/เพชร/ไลค์ไว้ที่ DB ตามเดิม
══════════════════════════════════════════════════════════ */

const NAMEPLATE_LIFE_MS = 4800;        // เวลาโชว์ป้ายชื่อ
const NAMEPLATE_DEDUPE_MS = 60_000;    // คนเดิมไม่ขึ้นซ้ำใน 60s
const MAX_VISIBLE = 3;                 // ซ้อนได้สูงสุด 3 ใบ

function pushNameplate(prev, item) {
  const next = [...prev, item];
  return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
}

function OverlayView() {
  const [queue, setQueue] = useState([]);       // ป้ายปกติ (มุมล่างซ้าย)
  const [vipQueue, setVipQueue] = useState([]); // ป้าย VIP top-3 (ลอยข้ามจอ)
  const topMapRef = useRef(new Map());          // uniqueId → rank (1|2|3) — ใช้ ref กัน stale closure
  const uidRef  = useRef(0);
  const seenRef = useRef(new Map());
  const mkid = () => `${Date.now()}-${++uidRef.current}`;

  const tryShow = (uid, displayName, forceRank) => {
    const name = (displayName || uid || '').trim();
    if (!name) return;
    const now = Date.now();
    const last = uid ? (seenRef.current.get(uid) || 0) : 0;
    if (uid && now - last < NAMEPLATE_DEDUPE_MS) return;
    if (uid) seenRef.current.set(uid, now);
    if (seenRef.current.size > 4000) {
      const cutoff = now - NAMEPLATE_DEDUPE_MS;
      for (const [k, t] of seenRef.current) if (t < cutoff) seenRef.current.delete(k);
    }
    const rank = forceRank || (uid ? topMapRef.current.get(uid) : null);
    if (rank) {
      setVipQueue(prev => {
        // จัดสลอตคงที่ (0,1) เพื่อกัน yOffset กระโดดเมื่อรายการกลางสลายไป
        const usedSlots = new Set(prev.map(p => p.slot));
        let slot = 0; while (usedSlots.has(slot)) slot++;
        if (slot > 1) { // เกินสลอต → ดันรายการเก่าสุดออก
          const dropped = prev[0];
          const remain = prev.slice(1);
          const used2 = new Set(remain.map(p => p.slot));
          slot = 0; while (used2.has(slot)) slot++;
          return [...remain, { _uid: mkid(), name, rank, slot }];
        }
        return [...prev, { _uid: mkid(), name, rank, slot }];
      });
    } else {
      setQueue(prev => pushNameplate(prev, { _uid: mkid(), name }));
    }
  };

  // DEMO
  useEffect(() => {
    if (!IS_DEMO) return;
    const names = ['BabyNoryy', 'KingArthur', 'StarLight ✦', 'นักรบทองคำ', 'LegendX'];
    let i = 0;
    const fire = () => {
      const uid = `demo-${i}`;
      const rank = i < 3 ? (i + 1) : null; // 0,1,2 = TOP1,2,3
      tryShow(uid, names[i % names.length], rank);
      i++;
    };
    fire();
    const iv = setInterval(fire, 3200);
    return () => clearInterval(iv);
  }, []);

  // โหลด Top-3 ตอน mount
  useEffect(() => {
    if (!OVERLAY_USER) return;
    fetch(`/api/top-diamond-senders/${encodeURIComponent(OVERLAY_USER)}`)
      .then(r => r.json())
      .then(d => {
        const m = new Map();
        (d?.top || []).forEach(t => m.set(t.uniqueId, t.rank));
        topMapRef.current = m;
      })
      .catch(()=>{});
  }, []);

  // socket subscriptions (run once)
  useEffect(() => {
    if (!overlaySock) return;
    const onMember = (d) => tryShow(d?.uniqueId, d?.displayName || d?.uniqueId);
    const onChat   = (d) => tryShow(d?.uniqueId, d?.displayName || d?.uniqueId);
    const onTop    = (list) => {
      const m = new Map();
      (list || []).forEach(t => m.set(t.uniqueId, t.rank));
      topMapRef.current = m;
    };
    overlaySock.on('tiktokMember', onMember);
    overlaySock.on('tiktokChat',   onChat);
    overlaySock.on('topDiamondSenders', onTop);
    return () => {
      overlaySock.off('tiktokMember', onMember);
      overlaySock.off('tiktokChat',   onChat);
      overlaySock.off('topDiamondSenders', onTop);
    };
  }, []);

  function dismiss(uid) {
    setQueue(prev => prev.filter(q => q._uid !== uid));
  }
  function dismissVip(uid) {
    setVipQueue(prev => prev.filter(q => q._uid !== uid));
  }

  const isPreview = params.has('preview');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700;900&family=Cinzel:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Noto Sans Thai',sans-serif}
        html,body{width:100%;height:100%;background:${isPreview?'linear-gradient(135deg,#08000e 0%,#140025 40%,#0c0018 100%)':'transparent'};overflow:hidden}
        @keyframes np-shimmer{0%{background-position:-200% 50%}100%{background-position:200% 50%}}
        @keyframes np-sweep  {0%{transform:translateX(-120%) skewX(-18deg)}60%,100%{transform:translateX(220%) skewX(-18deg)}}
        @keyframes np-glow   {0%,100%{filter:drop-shadow(0 0 14px rgba(255,200,60,.55)) drop-shadow(0 0 28px rgba(220,80,255,.35))}50%{filter:drop-shadow(0 0 22px rgba(255,215,80,.85)) drop-shadow(0 0 44px rgba(255,128,255,.55))}}
        @keyframes np-spark  {0%{opacity:0;transform:translate(0,0) scale(.4)}30%{opacity:1}100%{opacity:0;transform:translate(var(--sx),var(--sy)) scale(.9)}}
        @keyframes vip-rainbow{0%,100%{filter:hue-rotate(0deg) drop-shadow(0 0 24px rgba(255,200,60,.9)) drop-shadow(0 0 60px rgba(220,80,255,.7))}50%{filter:hue-rotate(40deg) drop-shadow(0 0 36px rgba(255,150,255,1)) drop-shadow(0 0 80px rgba(80,200,255,.85))}}
        @keyframes vip-trail {0%{opacity:0;transform:translateX(-30px) scale(.6)}40%{opacity:1}100%{opacity:0;transform:translateX(60px) scale(1.1)}}
      `}</style>

      {isPreview && (
        <div style={{ position:'fixed', top:16, left:16, right:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, zIndex:50 }}>
          <div style={{ background:'rgba(10,0,20,.88)', border:'1px solid rgba(155,81,224,.35)', borderRadius:10, padding:'7px 14px', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,200,60,.9)', letterSpacing:'.15em' }}>👁 PREVIEW</span>
            {OVERLAY_USER && <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>@{OVERLAY_USER}</span>}
          </div>
          <div style={{ background:'rgba(10,0,20,.82)', border:'1px solid rgba(100,80,150,.2)', borderRadius:9, padding:'6px 12px', fontSize:10, color:'rgba(180,160,220,.4)' }}>
            OBS Browser Source: ลบ ?preview ออก
          </div>
        </div>
      )}

      <div style={{
        position:'fixed', bottom:48, left:48, display:'flex', flexDirection:'column',
        alignItems:'flex-start', gap:14, pointerEvents:'none', zIndex:50,
      }}>
        <AnimatePresence>
          {queue.map(item => (
            <NamePlate key={item._uid} name={item.name} onDone={() => dismiss(item._uid)} />
          ))}
        </AnimatePresence>
      </div>

      {/* VIP TOP-3: ลอยจากซ้าย→ขวาข้ามจอ อลังการกว่าปกติ */}
      <div style={{ position:'fixed', top:'42%', left:0, right:0, pointerEvents:'none', zIndex:60 }}>
        <AnimatePresence>
          {vipQueue.map(item => (
            <VipNamePlate key={item._uid} name={item.name} rank={item.rank} stackIdx={item.slot} onDone={() => dismissVip(item._uid)} />
          ))}
        </AnimatePresence>
      </div>

      {isPreview && queue.length === 0 && (
        <div style={{ position:'fixed', bottom:48, left:48, background:'rgba(10,0,20,.7)', border:'1px dashed rgba(255,200,60,.3)', borderRadius:12, padding:'14px 20px', backdropFilter:'blur(10px)' }}>
          <div style={{ fontSize:12, color:'rgba(255,200,60,.55)', letterSpacing:'.12em' }}>
            ✦ รอป้ายชื่อจากห้องไลฟ์...
          </div>
        </div>
      )}
    </>
  );
}

/* ── VIP NAMEPLATE: TOP-3 ผู้ส่งเพชร ลอยซ้าย→ขวาข้ามจออลังการ ── */
const VIP_LIFE_MS = 8200;
const RANK_THEME = {
  1: { label:'TOP 1', emoji:'👑', main:'#ffe14a', sub:'#ff5edb', tag:'⚜️ KING OF DIAMONDS', size:'clamp(34px,4vw,52px)' },
  2: { label:'TOP 2', emoji:'💎', main:'#a8f4ff', sub:'#9d8bff', tag:'★ DIAMOND ROYAL',     size:'clamp(28px,3.4vw,42px)' },
  3: { label:'TOP 3', emoji:'🏆', main:'#ffb86b', sub:'#ff5edb', tag:'✦ DIAMOND ELITE',     size:'clamp(26px,3vw,38px)' },
};
function VipNamePlate({ name, rank, stackIdx = 0, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, VIP_LIFE_MS);
    return () => clearTimeout(t);
  }, []);
  const th = RANK_THEME[rank] || RANK_THEME[3];
  const yOffset = stackIdx * 92;
  const trails = Array.from({ length: 6 }, (_, i) => i);
  return (
    <motion.div
      initial={{ x: '-110vw', opacity: 0, scale: 0.6 }}
      animate={{ x: ['-110vw', '12vw', '52vw', '110vw'], opacity: [0, 1, 1, 0], scale: [0.6, 1.05, 1.05, 0.85] }}
      exit={{ opacity: 0 }}
      transition={{ duration: VIP_LIFE_MS / 1000, ease: [0.18, 0.62, 0.32, 1], times: [0, 0.18, 0.78, 1] }}
      style={{
        position:'absolute', top: yOffset, left: 0,
        animation:'vip-rainbow 2s ease-in-out infinite',
        willChange:'transform,opacity',
      }}
    >
      {/* ลำแสง trail ตามหลัง */}
      <div style={{ position:'absolute', top:'50%', left:-160, transform:'translateY(-50%)', width:300, height:80, pointerEvents:'none',
        background:`linear-gradient(90deg, transparent 0%, ${th.main}aa 60%, ${th.sub}cc 100%)`,
        filter:'blur(18px)', borderRadius:'50%' }} />
      {/* aura */}
      <div style={{ position:'absolute', inset:-22, borderRadius:30, pointerEvents:'none',
        background:`radial-gradient(ellipse at center, ${th.main}66 0%, ${th.sub}44 45%, transparent 75%)`, filter:'blur(20px)' }} />

      <div style={{
        position:'relative', display:'inline-flex', alignItems:'center', gap:18,
        padding:'18px 36px 18px 28px', borderRadius:18,
        background:`linear-gradient(135deg, rgba(20,4,12,.94), rgba(38,8,40,.94) 50%, rgba(8,8,40,.94))`,
        boxShadow:`0 14px 60px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.18), 0 0 80px ${th.main}55`,
      }}>
        {/* rainbow border */}
        <div style={{
          position:'absolute', inset:0, borderRadius:18, padding:2.5, pointerEvents:'none',
          background:`linear-gradient(120deg, ${th.main} 0%, ${th.sub} 25%, #80c8ff 50%, ${th.main} 75%, #fff2a8 100%)`,
          backgroundSize:'250% 100%', animation:'np-shimmer 2.4s linear infinite',
          WebkitMask:'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite:'xor', maskComposite:'exclude',
        }} />

        {/* rank badge */}
        <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
          <div style={{ fontSize:38, lineHeight:1, filter:`drop-shadow(0 0 14px ${th.main})` }}>{th.emoji}</div>
          <div style={{ fontSize:10, fontWeight:900, letterSpacing:'.18em', padding:'2px 8px', borderRadius:8,
            background:`linear-gradient(135deg, ${th.main}, ${th.sub})`, color:'#1a0820',
            boxShadow:`0 0 12px ${th.main}88` }}>{th.label}</div>
        </div>

        {/* name + tag */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:900, letterSpacing:'.32em', textTransform:'uppercase',
            background:`linear-gradient(90deg, ${th.main}, ${th.sub})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            fontFamily:'Cinzel,serif' }}>{th.tag}</div>
          <div style={{
            fontSize: th.size, fontWeight:900, lineHeight:1.05, letterSpacing:'.01em',
            background:`linear-gradient(110deg, #fff8d6 0%, ${th.main} 25%, #ff9ce0 50%, ${th.sub} 75%, #fff8d6 100%)`,
            backgroundSize:'250% 100%',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            animation:'np-shimmer 3s linear infinite',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'48vw',
            filter:`drop-shadow(0 2px 0 rgba(0,0,0,.55)) drop-shadow(0 0 16px ${th.main}cc)`,
          }}>{name}</div>
        </div>

        {/* light sweep */}
        <div style={{ position:'absolute', inset:0, overflow:'hidden', borderRadius:18, pointerEvents:'none' }}>
          <div style={{ position:'absolute', top:0, bottom:0, left:0, width:'45%',
            background:'linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)',
            mixBlendMode:'screen', animation:'np-sweep 1.8s ease-in-out infinite' }} />
        </div>

        {/* particles trailing */}
        {trails.map(i => (
          <span key={i} style={{
            position:'absolute', left: -20 - i * 12, top: `${30 + ((i*17)%40)}%`,
            fontSize: 14 + (i%3)*6, color: i%2 ? th.main : th.sub,
            animation: `vip-trail ${1.4 + i*0.18}s ${i*0.12}s ease-out infinite`,
            textShadow: `0 0 12px currentColor`, pointerEvents:'none',
          }}>{['✦','✨','💎','★','⚡','◆'][i]}</span>
        ))}
      </div>
    </motion.div>
  );
}

/* ── ป้ายชื่อ: ทอง + รุ้ง compact, light effects ── */
function NamePlate({ name, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, NAMEPLATE_LIFE_MS);
    return () => clearTimeout(t);
  }, []);

  // sparkles ตำแหน่งสุ่มแบบ deterministic จากชื่อ
  const sparkles = (() => {
    const arr = [];
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    for (let i = 0; i < 8; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const dx = ((h & 255) - 128) * 0.9;
      const dy = (((h >> 8) & 255) - 180) * 0.55;
      arr.push({ left: 8 + ((h >> 16) & 0x7f) * 0.45 + '%', top: 30 + ((h >> 20) & 0x3f) * 0.6 + '%', dx, dy, delay: (i * 0.13).toFixed(2) });
    }
    return arr;
  })();

  return (
    <motion.div
      initial={{ x: -60, opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
      animate={{ x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ x: -40, opacity: 0, scale: 0.9, filter: 'blur(4px)', transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 220, damping: 22, mass: 0.7 }}
      style={{ position: 'relative', maxWidth: 460, animation: 'np-glow 2.4s ease-in-out infinite' }}
    >
      {/* outer aura */}
      <div style={{
        position:'absolute', inset:-14, borderRadius:22, pointerEvents:'none',
        background:'radial-gradient(ellipse at center, rgba(255,200,60,.35) 0%, rgba(220,80,255,.22) 45%, transparent 75%)',
        filter:'blur(14px)',
      }} />

      {/* main plate */}
      <div style={{
        position:'relative', overflow:'hidden',
        padding:'14px 28px 14px 24px',
        borderRadius:14,
        background:'linear-gradient(135deg, rgba(20,8,4,.92) 0%, rgba(38,10,28,.92) 50%, rgba(8,8,28,.92) 100%)',
        border:'1.5px solid transparent',
        backgroundClip:'padding-box',
        boxShadow:'0 8px 30px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,220,140,.18)',
      }}>
        {/* gold/rainbow border ring */}
        <div style={{
          position:'absolute', inset:0, borderRadius:14, padding:1.5, pointerEvents:'none',
          background:'linear-gradient(120deg, #ffd76b 0%, #ff80d8 25%, #80c8ff 50%, #ffd76b 75%, #fff2a8 100%)',
          backgroundSize:'250% 100%',
          animation:'np-shimmer 4s linear infinite',
          WebkitMask:'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite:'xor', maskComposite:'exclude',
        }} />

        {/* left ornament */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:14,
        }}>
          <div style={{
            fontSize:22, lineHeight:1,
            background:'linear-gradient(135deg, #fff2a8 0%, #ffd76b 35%, #ff80d8 70%, #80c8ff 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            filter:'drop-shadow(0 0 6px rgba(255,200,60,.7))',
          }}>✦</div>

          <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
            <div style={{
              fontSize:10, fontWeight:800, letterSpacing:'.32em',
              color:'rgba(255,210,110,.85)', textTransform:'uppercase',
              fontFamily:'Cinzel,serif',
            }}>
              welcome
            </div>
            <div style={{
              fontSize:'clamp(22px,2.4vw,30px)', fontWeight:900, lineHeight:1.1, letterSpacing:'.01em',
              background:'linear-gradient(110deg, #fff8d6 0%, #ffd76b 22%, #ff9ce0 45%, #9ed8ff 65%, #ffe48a 88%, #fff8d6 100%)',
              backgroundSize:'250% 100%',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              animation:'np-shimmer 3.6s linear infinite',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:380,
              filter:'drop-shadow(0 1px 0 rgba(0,0,0,.45)) drop-shadow(0 0 10px rgba(255,200,60,.35))',
            }}>
              {name}
            </div>
          </div>

          <div style={{
            fontSize:22, lineHeight:1,
            background:'linear-gradient(135deg, #80c8ff 0%, #ff80d8 35%, #ffd76b 70%, #fff2a8 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            filter:'drop-shadow(0 0 6px rgba(220,80,255,.65))',
            marginLeft:6,
          }}>✦</div>
        </div>

        {/* light sweep */}
        <div style={{
          position:'absolute', top:0, bottom:0, left:0, width:'45%', pointerEvents:'none',
          background:'linear-gradient(90deg, transparent, rgba(255,240,180,.35), transparent)',
          mixBlendMode:'screen', animation:'np-sweep 2.6s ease-in-out infinite',
        }} />

        {/* sparkles */}
        {sparkles.map((s, i) => (
          <span key={i} style={{
            position:'absolute', left:s.left, top:s.top, width:6, height:6, borderRadius:'50%',
            background:'radial-gradient(circle, #fff 0%, #ffd76b 40%, transparent 70%)',
            ['--sx']: `${s.dx}px`, ['--sy']: `${s.dy}px`,
            animation:`np-spark 1.6s ${s.delay}s ease-out infinite`,
            pointerEvents:'none',
          }} />
        ))}
      </div>
    </motion.div>
  );
}
