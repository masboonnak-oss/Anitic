import { useEffect, useState, useRef, useCallback } from 'react';
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
  const sockRef    = useRef(null);
  const [username, setUsername]   = useState(() => localStorage.getItem('re_lastUser') || '');
  const [status,   setStatus]     = useState('idle'); // idle | connecting | live | error
  const [errMsg,   setErrMsg]     = useState('');
  const [viewers,  setViewers]    = useState(0);
  const [likes,    setLikes]      = useState(0);
  const [diamonds, setDiamonds]   = useState(0);
  const [copied,   setCopied]     = useState(false);

  const chatRef = useRef(null);
  const giftRef = useRef(null);
  const [chatItems, setChatItems] = useState([]);
  const [giftItems, setGiftItems] = useState([]);

  const chatAutoRef = useRef(true);
  const giftAutoRef = useRef(true);
  const [chatAuto, setChatAutoS]  = useState(true);
  const [giftAuto, setGiftAutoS]  = useState(true);

  const uidRef = useRef(0);
  const mkid   = () => `${Date.now()}-${++uidRef.current}`;

  /* ── connect ── */
  function connect() {
    const u = username.trim().replace(/^@/, '');
    if (!u) return;
    if (!sockRef.current) {
      sockRef.current = io('/', { transports: ['websocket', 'polling'] });
      wireSocket(sockRef.current);
    }
    setStatus('connecting');
    setErrMsg('');
    localStorage.setItem('re_lastUser', u);
    sockRef.current.emit('setUniqueId', u, {});
  }

  function disconnect() {
    if (sockRef.current) {
      sockRef.current.emit('disconnect_tiktok');
    }
    setStatus('idle');
    setViewers(0); setLikes(0); setDiamonds(0);
  }

  function wireSocket(sock) {
    sock.on('tiktokConnected',    ()    => setStatus('live'));
    sock.on('tiktokDisconnected', (msg) => { setStatus('error'); setErrMsg(msg || 'ตัดการเชื่อมต่อ'); });
    sock.on('roomUser',  d => { if (typeof d?.viewerCount === 'number') setViewers(d.viewerCount); });
    sock.on('like',      d => { if (typeof d?.totalLikeCount === 'number') setLikes(d.totalLikeCount); });

    sock.on('member', d => pushChat({
      id: mkid(), type: 'join',
      uniqueId: d.uniqueId || '?', displayName: d.displayName || d.uniqueId || '?',
      profilePicUrl: null, text: 'เข้าร่วมห้อง',
    }));

    sock.on('chat', d => pushChat({
      id: mkid(), type: 'chat',
      uniqueId: d.uniqueId, displayName: d.displayName,
      profilePicUrl: d.profilePicUrl, text: d.comment,
    }));

    sock.on('like', d => {
      if (typeof d?.likeCount === 'number' && d.likeCount > 0) pushChat({
        id: mkid(), type: 'like',
        uniqueId: d.uniqueId || '?', displayName: d.displayName || d.uniqueId || '?',
        profilePicUrl: d.profilePicUrl || null, text: `❤️ ${d.likeCount} likes`,
      });
    });

    sock.on('follow', d => pushChat({
      id: mkid(), type: 'follow',
      uniqueId: d.uniqueId, displayName: d.displayName,
      profilePicUrl: d.profilePicUrl, text: 'กดติดตาม',
    }));

    sock.on('share', d => pushChat({
      id: mkid(), type: 'share',
      uniqueId: d.uniqueId, displayName: d.displayName,
      profilePicUrl: d.profilePicUrl, text: 'แชร์ไลฟ์',
    }));

    sock.on('gift', d => {
      setDiamonds(prev => prev + (d.diamonds || 0));
      pushGift({ id: mkid(), ...d });
    });
  }

  function pushChat(item) {
    setChatItems(prev => {
      const next = [...prev, item];
      return next.length > 300 ? next.slice(next.length - 300) : next;
    });
  }
  function pushGift(item) {
    setGiftItems(prev => {
      const next = [...prev, item];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }

  /* auto-scroll */
  useEffect(() => {
    if (chatAutoRef.current && chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatItems]);
  useEffect(() => {
    if (giftAutoRef.current && giftRef.current) giftRef.current.scrollTop = giftRef.current.scrollHeight;
  }, [giftItems]);

  function toggleChatAuto() { chatAutoRef.current = !chatAutoRef.current; setChatAutoS(chatAutoRef.current); }
  function toggleGiftAuto() { giftAutoRef.current = !giftAutoRef.current; setGiftAutoS(giftAutoRef.current); }

  /* overlay URL */
  const overlayUrl = `${window.location.origin}/roomeffects?u=${username.trim().replace(/^@/,'')}`;
  function copyOverlay() {
    navigator.clipboard.writeText(overlayUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const statusColor = { idle: '#666', connecting: '#f5a623', live: '#22c55e', error: '#ef4444' }[status];
  const statusLabel = { idle: '⚫ ไม่ได้เชื่อมต่อ', connecting: '🟡 กำลังเชื่อมต่อ...', live: '🟢 LIVE', error: '🔴 ผิดพลาด' }[status];

  const EVENT_COLOR  = { join: '#21b2c2', chat: '#e0e0ff', like: '#f472b6', follow: '#fbbf24', share: '#4ade80' };
  const EVENT_LABEL  = { join: '🚪', chat: '💬', like: '❤️', follow: '👑', share: '📢' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #06030f; color: #e0e0f0; font-family: 'Noto Sans Thai', 'Segoe UI', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(155,81,224,.35); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(155,81,224,.6); }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

        {/* ─── HEADER ─── */}
        <div style={{ background:'rgba(10,5,25,.98)', borderBottom:'1px solid rgba(155,81,224,.2)', padding:'10px 20px', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, background:'linear-gradient(135deg,#c060ff,#fe2c55)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'0.05em' }}>
              🚪 คนเข้าห้องเท่ๆ
            </div>
            <div style={{ fontSize:11, color:'rgba(155,81,224,.6)', marginTop:1 }}>TikTok Live Chat Capture + OBS Overlay</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: statusColor, animation: status==='live'?'pulse-dot 1.5s infinite':undefined }} />
            <span style={{ fontSize:12, color: statusColor, fontWeight:700 }}>{statusLabel}</span>
          </div>
        </div>

        {/* ─── CONNECT PANEL ─── */}
        <div style={{ background:'rgba(12,5,28,.95)', borderBottom:'1px solid rgba(155,81,224,.15)', padding:'12px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:14, color:'rgba(200,180,255,.6)', whiteSpace:'nowrap' }}>@ username :</span>
          <div style={{ position:'relative', flex:'1 1 160px', maxWidth:280 }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'rgba(155,81,224,.7)', fontWeight:700, fontSize:14 }}>@</span>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key==='Enter' && status==='idle' && connect()}
              placeholder="tiktok_username"
              disabled={status === 'connecting' || status === 'live'}
              style={{ width:'100%', background:'rgba(30,15,60,.8)', border:'1px solid rgba(155,81,224,.35)', borderRadius:8, color:'#e0e0ff', padding:'7px 12px 7px 28px', fontSize:14, outline:'none', transition:'border-color .15s' }}
            />
          </div>
          {status === 'idle' || status === 'error' ? (
            <button onClick={connect} disabled={!username.trim()} style={{ background:'linear-gradient(135deg,rgba(138,43,226,.8),rgba(254,44,85,.6))', border:'none', borderRadius:8, color:'#fff', padding:'7px 20px', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', opacity: username.trim()?1:.5 }}>
              ▶ เชื่อมต่อ
            </button>
          ) : status === 'connecting' ? (
            <button disabled style={{ background:'rgba(245,166,35,.15)', border:'1px solid rgba(245,166,35,.4)', borderRadius:8, color:'#f5a623', padding:'7px 20px', fontSize:13, fontWeight:700, cursor:'not-allowed' }}>
              ⏳ กำลังเชื่อมต่อ...
            </button>
          ) : (
            <button onClick={disconnect} style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.5)', borderRadius:8, color:'#ef4444', padding:'7px 20px', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              ⏹ ตัดการเชื่อมต่อ
            </button>
          )}
          {/* Stats */}
          <div style={{ marginLeft:'auto', display:'flex', gap:18, fontSize:13 }}>
            {[['👁', viewers.toLocaleString(), '#60a5fa'],['❤️', likes.toLocaleString(), '#f472b6'],['💎', diamonds.toLocaleString(), '#a78bfa']].map(([e,v,c]) => (
              <span key={e} style={{ color:'rgba(200,200,220,.5)', display:'flex', gap:4, alignItems:'center' }}>
                {e} <b style={{ color: c }}>{v}</b>
              </span>
            ))}
          </div>
          {errMsg && <div style={{ width:'100%', fontSize:12, color:'#ef4444', marginTop:2 }}>⚠️ {errMsg}</div>}
        </div>

        {/* ─── OVERLAY URL BAR ─── */}
        <div style={{ background:'rgba(0,40,30,.5)', borderBottom:'1px solid rgba(0,200,140,.15)', padding:'9px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'rgba(0,220,150,.7)', fontWeight:700, whiteSpace:'nowrap' }}>🎬 Overlay URL (TikTok Live Studio / OBS) :</span>
          <div style={{ flex:'1 1 200px', background:'rgba(0,0,0,.4)', border:'1px solid rgba(0,200,140,.25)', borderRadius:7, padding:'5px 12px', fontSize:12, color: username.trim()?'#00dda0':'rgba(100,120,100,.5)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {username.trim() ? overlayUrl : 'กรุณาใส่ username ก่อน'}
          </div>
          <button
            onClick={copyOverlay}
            disabled={!username.trim()}
            style={{ background: copied?'rgba(0,200,140,.2)':'rgba(0,180,120,.12)', border:`1px solid ${copied?'rgba(0,200,140,.7)':'rgba(0,200,140,.35)'}`, borderRadius:7, color: copied?'#00ffaa':'#00dda0', padding:'5px 16px', fontSize:12, fontWeight:700, cursor: username.trim()?'pointer':'not-allowed', whiteSpace:'nowrap', transition:'all .2s' }}
          >
            {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอก URL'}
          </button>
          <a
            href={username.trim() ? `${overlayUrl}&preview` : '#'}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize:12, color:'rgba(0,200,140,.6)', textDecoration:'none', fontWeight:600, whiteSpace:'nowrap' }}
          >↗ ดูตัวอย่าง</a>
        </div>

        {/* ─── CHAT + GIFT SPLIT ─── */}
        <div style={{ flex:1, minHeight:0, display:'flex', gap:0, overflow:'hidden' }}>

          {/* LEFT — Chat */}
          <div style={{ flex:'1 1 0', minWidth:0, display:'flex', flexDirection:'column', borderRight:'1px solid rgba(155,81,224,.12)' }}>
            <div style={{ padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(155,81,224,.12)', background:'rgba(10,5,25,.7)', flexShrink:0 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(155,81,224,.7)' }}>💬 แชท &amp; เหตุการณ์</span>
              <div style={{ display:'flex', gap:6 }}>
                <SmallBtn onClick={toggleChatAuto} active={chatAuto}>{chatAuto?'Auto ✓':'Auto'}</SmallBtn>
                <SmallBtn onClick={() => setChatItems([])}>ล้าง</SmallBtn>
              </div>
            </div>
            <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'4px 8px 8px' }}>
              {chatItems.length === 0
                ? <EmptyState icon="💬" text={status==='live'?'รอแชท...':'เชื่อมต่อ TikTok Live เพื่อดูแชทแบบ Real-time'} />
                : chatItems.map(item => (
                  <ChatRow key={item.id} item={item} color={EVENT_COLOR[item.type]||'#e0e0ff'} label={EVENT_LABEL[item.type]||'•'} />
                ))
              }
            </div>
          </div>

          {/* RIGHT — Gifts */}
          <div style={{ flex:'0 0 320px', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(155,81,224,.12)', background:'rgba(10,5,25,.7)', flexShrink:0 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(236,72,153,.7)' }}>🎁 ของขวัญ</span>
              <div style={{ display:'flex', gap:6 }}>
                <SmallBtn onClick={toggleGiftAuto} active={giftAuto}>{giftAuto?'Auto ✓':'Auto'}</SmallBtn>
                <SmallBtn onClick={() => setGiftItems([])}>ล้าง</SmallBtn>
              </div>
            </div>
            <div ref={giftRef} style={{ flex:1, overflowY:'auto', padding:'4px 8px 8px' }}>
              {giftItems.length === 0
                ? <EmptyState icon="🎁" text={status==='live'?'รอของขวัญ...':'ของขวัญจะปรากฏที่นี่'} />
                : giftItems.map(item => <GiftRow key={item.id} item={item} />)
              }
            </div>
          </div>
        </div>

        {/* ─── FOOTER ─── */}
        <div style={{ padding:'6px 20px', borderTop:'1px solid rgba(155,81,224,.1)', background:'rgba(8,4,18,.9)', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
          {Object.entries(EVENT_COLOR).map(([type, color]) => (
            <span key={type} style={{ fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block' }} />
              <span style={{ color:'rgba(180,180,200,.5)' }}>{ {join:'เข้าห้อง',chat:'แชท',like:'ไลค์',follow:'ติดตาม',share:'แชร์'}[type] }</span>
            </span>
          ))}
          <span style={{ marginLeft:'auto', fontSize:11, color:'rgba(100,80,140,.5)' }}>WIN Leaderboard · คนเข้าห้องเท่ๆ</span>
        </div>
      </div>
    </>
  );
}

/* ── Small helper button ── */
function SmallBtn({ onClick, children, active }) {
  return (
    <button onClick={onClick} style={{ background: active?'rgba(155,81,224,.18)':'rgba(255,255,255,.04)', border:`1px solid ${active?'rgba(155,81,224,.45)':'rgba(255,255,255,.08)'}`, borderRadius:5, color: active?'rgba(155,81,224,.9)':'rgba(180,180,200,.5)', fontSize:10, fontWeight:600, padding:'2px 9px', cursor:'pointer' }}>
      {children}
    </button>
  );
}

/* ── Empty state ── */
function EmptyState({ icon, text }) {
  return (
    <div style={{ padding:'32px 16px', textAlign:'center', color:'rgba(120,100,160,.4)' }}>
      <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:12 }}>{text}</div>
    </div>
  );
}

/* ── Chat row ── */
function ChatRow({ item, color, label }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:7, padding:'3px 6px', borderRadius:6, fontSize:13, lineHeight:1.5 }}>
      {item.profilePicUrl
        ? <img src={item.profilePicUrl} alt="" style={{ width:20, height:20, borderRadius:'50%', objectFit:'cover', flexShrink:0, marginTop:2 }} onError={e=>e.target.style.display='none'} />
        : <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(155,81,224,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0, marginTop:2, color:'rgba(200,160,255,.8)' }}>{(item.displayName||'?')[0].toUpperCase()}</div>
      }
      <span style={{ flex:1, minWidth:0, wordBreak:'break-word' }}>
        <a href={`https://www.tiktok.com/@${item.uniqueId}`} target="_blank" rel="noreferrer" style={{ color:'rgba(200,160,255,.9)', fontWeight:700, textDecoration:'none', marginRight:4 }}>{item.displayName||item.uniqueId}</a>
        <span style={{ color }}>{label} {item.text}</span>
      </span>
    </div>
  );
}

/* ── Gift row ── */
function GiftRow({ item }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 8px', borderRadius:8, background:'rgba(236,72,153,.06)', border:'1px solid rgba(236,72,153,.1)', marginBottom:4 }}>
      {item.profilePicUrl
        ? <img src={item.profilePicUrl} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'1.5px solid rgba(236,72,153,.5)' }} onError={e=>e.target.style.display='none'} />
        : <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(180,30,100,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, color:'#ffaad4' }}>{(item.displayName||'?')[0].toUpperCase()}</div>
      }
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#ffaad4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.displayName||item.uniqueId}</div>
        <div style={{ fontSize:12, color:'rgba(255,160,220,.7)', display:'flex', gap:6, flexWrap:'wrap', marginTop:1 }}>
          <span>🎁 {item.giftName||'ของขวัญ'}</span>
          {item.repeatCount>1 && <span style={{ color:'rgba(255,200,100,.7)' }}>×{item.repeatCount}</span>}
          {item.diamonds>0 && <span style={{ color:'rgba(167,139,250,.8)' }}>💎 {item.diamonds.toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   ██████  OVERLAY VIEW  (OBS / TikTok Live Studio)
══════════════════════════════════════════════════════════ */

/* ── standalone socket for overlay ── */
const overlaySock = IS_OVERLAY ? io('/', { transports: ['websocket','polling'] }) : null;

/* ── demo item ── */
const DEMO_ITEM = { _uid:'demo-1', variant:'join', uniqueId:'babynoey', displayName:'BabyNoey 👑', profilePicUrl:null, level:30 };

function addToQueue(prev, item) {
  const next = [...prev, item];
  return next.length > 3 ? next.slice(next.length - 3) : next;
}

function OverlayView() {
  const [queue,   setQueue]   = useState(IS_DEMO ? [DEMO_ITEM] : []);
  const [flash,   setFlash]   = useState(false);
  const [connSt,  setConnSt]  = useState('connecting'); // connecting | live | error
  const uidRef = useRef(0);
  const mkid   = () => `${Date.now()}-${++uidRef.current}`;

  /* connect overlay directly via setUniqueId (standalone, no admin needed) */
  function doConnect() {
    if (!overlaySock || !OVERLAY_USER) return;
    setConnSt('connecting');
    overlaySock.emit('setUniqueId', OVERLAY_USER, {});
  }

  useEffect(() => {
    if (!overlaySock) return;

    /* (re)connect on socket connect */
    overlaySock.on('connect', doConnect);
    if (overlaySock.connected) doConnect();

    /* TikTok connection state */
    overlaySock.on('tiktokConnected',    ()    => setConnSt('live'));
    overlaySock.on('tiktokDisconnected', ()    => {
      setConnSt('error');
      /* auto-retry after 30s */
      setTimeout(doConnect, 30000);
    });

    function onMember(data) {
      setFlash(true); setTimeout(() => setFlash(false), 600);
      setQueue(prev => addToQueue(prev, {
        _uid: mkid(), variant: 'join',
        uniqueId: data.uniqueId, displayName: data.displayName || data.uniqueId || '?',
        profilePicUrl: data.profilePicUrl || null, level: data.level || 0,
      }));
    }
    function onGift(data) {
      setQueue(prev => addToQueue(prev, {
        _uid: mkid(), variant: 'gift',
        uniqueId: data.uniqueId, displayName: data.displayName || data.uniqueId || '?',
        profilePicUrl: data.profilePicUrl || null,
        giftName: data.giftName, repeatCount: data.repeatCount || 1, diamonds: data.diamonds || 0,
      }));
    }

    /* listen to events from setUniqueId path */
    overlaySock.on('member', onMember);
    overlaySock.on('gift',   onGift);
    /* also listen to admin-broadcast path (fallback) */
    overlaySock.on('tiktokMember', onMember);
    overlaySock.on('tiktokGift',   onGift);

    return () => {
      overlaySock.off('connect',           doConnect);
      overlaySock.off('tiktokConnected');
      overlaySock.off('tiktokDisconnected');
      overlaySock.off('member',      onMember);
      overlaySock.off('gift',        onGift);
      overlaySock.off('tiktokMember', onMember);
      overlaySock.off('tiktokGift',   onGift);
    };
  }, []);

  function dismiss(uid) { setQueue(prev => prev.filter(q => q._uid !== uid)); }
  const isPreview = params.has('preview');

  const connLabel = { connecting:'⏳ กำลังเชื่อมต่อ...', live:'🔴 LIVE', error:'⚠️ เชื่อมต่อไม่ได้ — รอสักครู่' }[connSt] || '';
  const connColor = { connecting:'rgba(245,166,35,.85)', live:'rgba(34,197,94,.9)', error:'rgba(239,68,68,.85)' }[connSt];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Noto Sans Thai',sans-serif}
        html,body{width:100%;height:100%;background:${isPreview?'linear-gradient(135deg,#08000e 0%,#140025 40%,#0c0018 100%)':'transparent'};overflow:hidden}
        @keyframes divineBreath{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
      `}</style>

      <AnimatePresence>
        {flash && (
          <motion.div key="flash"
            initial={{ opacity:0 }} animate={{ opacity:[0,.6,.3,0] }}
            transition={{ duration:.6, times:[0,.1,.4,1] }}
            style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:40,
              background:'radial-gradient(ellipse at center,rgba(255,200,50,0.5) 0%,rgba(200,80,255,0.3) 40%,transparent 70%)' }}
          />
        )}
      </AnimatePresence>

      {/* ── Status bar (always shown when preview, hidden in pure OBS mode) ── */}
      {isPreview && (
        <div style={{ position:'fixed', top:16, left:16, right:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, zIndex:50 }}>
          <div style={{ background:'rgba(10,0,20,.88)', border:`1px solid ${connSt==='live'?'rgba(34,197,94,.4)':connSt==='error'?'rgba(239,68,68,.4)':'rgba(155,81,224,.35)'}`, borderRadius:10, padding:'7px 14px', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(155,81,224,.8)', letterSpacing:'.15em' }}>👁 PREVIEW</span>
            {OVERLAY_USER && <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>@{OVERLAY_USER}</span>}
            <span style={{ fontSize:11, fontWeight:700, color: connColor }}>· {connLabel}</span>
          </div>
          <div style={{ background:'rgba(10,0,20,.82)', border:'1px solid rgba(100,80,150,.2)', borderRadius:9, padding:'6px 12px', fontSize:10, color:'rgba(180,160,220,.4)' }}>
            OBS Browser Source: ลบ ?preview ออกจาก URL
          </div>
        </div>
      )}

      <div style={{ position:'fixed', bottom:32, left:32, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16, pointerEvents:'none', zIndex:50, maxWidth:640 }}>
        <AnimatePresence>
          {queue.map(item => item.variant === 'gift'
            ? <GiftCard  key={item._uid} item={item} onDone={() => dismiss(item._uid)} />
            : <VIPCard   key={item._uid} item={item} onDone={() => dismiss(item._uid)} />
          )}
        </AnimatePresence>
      </div>

      {isPreview && queue.length === 0 && (
        <div style={{ position:'fixed', bottom:32, left:32, background:'rgba(10,0,20,.75)', border:'1px dashed rgba(155,81,224,.25)', borderRadius:12, padding:'16px 22px', backdropFilter:'blur(12px)', maxWidth:360 }}>
          <div style={{ fontSize:13, fontWeight:700, color: connColor, marginBottom:4 }}>{connLabel}</div>
          <div style={{ fontSize:12, color:'rgba(155,81,224,.45)' }}>
            {connSt==='live' ? '✅ เชื่อมต่อแล้ว รอคนเข้าห้อง...' : connSt==='error' ? '⚠️ ต้องไลฟ์ก่อนถึงจะเชื่อมต่อได้ จะลองใหม่ใน 30 วิ' : '⏳ กำลังลองเชื่อมต่อ TikTok Live...'}
          </div>
        </div>
      )}
    </>
  );
}

/* ── VIP Join Card ── */
function VIPCard({ item, onDone }) {
  const isVIP = (item.level || 0) >= 20;
  useEffect(() => { const t = setTimeout(onDone, 6500); return () => clearTimeout(t); }, []);

  return (
    <motion.div
      initial={{ x:-500, opacity:0, scale:.7, rotateY:-25 }}
      animate={{ x:0, opacity:1, scale:1, rotateY:0 }}
      exit={{ x:-500, opacity:0, scale:.8, filter:'blur(12px)' }}
      transition={{ type:'spring', stiffness:180, damping:18, mass:.8 }}
      style={{ position:'relative', width:'100%', maxWidth:600, perspective:'1200px' }}
    >
      {/* glow halo */}
      <div style={{ position:'absolute', inset:-24, borderRadius:24, pointerEvents:'none', background: isVIP?'radial-gradient(ellipse,rgba(255,200,30,.35) 0%,rgba(200,80,255,.25) 40%,transparent 70%)':'radial-gradient(ellipse,rgba(155,81,224,.3) 0%,transparent 70%)', filter:'blur(20px)', animation:'divineBreath 2s ease-in-out infinite' }} />

      {/* VIP light rays */}
      {isVIP && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:0 }}>
          {[...Array(12)].map((_,i) => (
            <motion.div key={i} style={{ position:'absolute', left:60, top:40, width:400, height:2, rotate:`${i*30}deg`, transformOrigin:'0 50%', borderRadius:99, background:`linear-gradient(to right,${i%2===0?'rgba(255,200,50,.8)':'rgba(220,80,255,.6)'},transparent)` }}
              initial={{ scaleX:0, opacity:0 }} animate={{ scaleX:[0,1,.8,1], opacity:[0,.9,.6,.8] }}
              transition={{ duration:.8+i*.05, delay:.1, repeat:Infinity, repeatType:'reverse', repeatDelay:.5 }}
            />
          ))}
        </div>
      )}

      {/* card body */}
      <div style={{ position:'relative', overflow:'hidden', borderRadius:16, border:'2px solid', backdropFilter:'blur(24px)', background: isVIP?'linear-gradient(135deg,rgba(20,8,40,.97) 0%,rgba(40,12,60,.97) 40%,rgba(20,8,30,.97) 100%)':'linear-gradient(135deg,rgba(15,8,35,.97) 0%,rgba(30,10,55,.97) 100%)', borderColor: isVIP?'rgba(255,190,30,.7)':'rgba(155,81,224,.6)', boxShadow: isVIP?'0 0 40px rgba(255,190,30,.5),0 0 80px rgba(200,80,255,.3),inset 0 1px 0 rgba(255,220,80,.2)':'0 0 30px rgba(155,81,224,.6),inset 0 1px 0 rgba(155,81,224,.2)' }}>
        {/* top sweep */}
        <motion.div style={{ position:'absolute', top:0, left:0, height:2, borderRadius:99, background: isVIP?'linear-gradient(to right,transparent,rgba(255,200,50,1),rgba(255,100,255,1),transparent)':'linear-gradient(to right,transparent,rgba(155,81,224,1),rgba(236,72,153,1),transparent)' }} initial={{ width:'0%', left:'50%' }} animate={{ width:'100%', left:'0%' }} transition={{ duration:.6, ease:'easeOut' }} />
        {/* scanlines */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:.1, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)' }} />
        {/* corners */}
        {[{t:8,l:8,bt:'top',bl:'left'},{t:8,r:8,bt:'top',bl:'right'},{b:8,l:8,bt:'bottom',bl:'left'},{b:8,r:8,bt:'bottom',bl:'right'}].map((c,i) => (
          <div key={i} style={{ position:'absolute', width:20, height:20, top:c.t, bottom:c.b, left:c.l, right:c.r, [`border${c.bt[0].toUpperCase()+c.bt.slice(1)}`]:`2px solid ${isVIP?'rgba(255,200,50,.8)':'rgba(155,81,224,.7)'}`, [`border${c.bl[0].toUpperCase()+c.bl.slice(1)}`]:`2px solid ${isVIP?'rgba(255,200,50,.8)':'rgba(155,81,224,.7)'}`, borderRadius: c.bt==='top'&&c.bl==='left'?'6px 0 0 0':c.bt==='top'&&c.bl==='right'?'0 6px 0 0':c.bt==='bottom'&&c.bl==='left'?'0 0 0 6px':'0 0 6px 0' }} />
        ))}

        <div style={{ position:'relative', padding:16, display:'flex', alignItems:'center', gap:16, zIndex:2 }}>
          {/* avatar */}
          <motion.div initial={{ scale:0, rotate:-180 }} animate={{ scale:1, rotate:0 }} transition={{ type:'spring', stiffness:300, damping:20, delay:.2 }} style={{ position:'relative', flexShrink:0 }}>
            {isVIP && <motion.div style={{ position:'absolute', top:-16, left:'50%', transform:'translateX(-50%)', fontSize:22 }} initial={{ y:-10, opacity:0 }} animate={{ y:[0,-4,0], opacity:1 }} transition={{ delay:.4, y:{ duration:1.5, repeat:Infinity } }}>👑</motion.div>}
            <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:`3px solid ${isVIP?'rgba(255,200,50,.9)':'rgba(155,81,224,.9)'}`, boxShadow: isVIP?'0 0 20px rgba(255,180,30,.9),0 0 40px rgba(255,100,255,.5)':'0 0 20px rgba(155,81,224,.9)', flexShrink:0 }}>
              {item.profilePicUrl
                ? <img src={item.profilePicUrl} alt={item.displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,rgba(155,81,224,.4),rgba(236,72,153,.4))' }}><span style={{ color:'#fff', fontWeight:900, fontSize:28 }}>{(item.displayName||'?')[0].toUpperCase()}</span></div>
              }
            </div>
            <motion.div style={{ position:'absolute', inset:-4, borderRadius:'50%', border:`2px dashed ${isVIP?'rgba(255,200,50,.5)':'rgba(155,81,224,.5)'}`, pointerEvents:'none' }} animate={{ rotate:360 }} transition={{ duration:4, repeat:Infinity, ease:'linear' }} />
          </motion.div>

          {/* text */}
          <div style={{ flex:1, minWidth:0 }}>
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:.15 }} style={{ marginBottom:4 }}>
              {isVIP
                ? <span style={{ fontSize:10, fontWeight:900, letterSpacing:'.3em', textTransform:'uppercase', padding:'2px 8px', borderRadius:4, background:'linear-gradient(135deg,rgba(255,180,30,.25),rgba(220,80,255,.25))', color:'rgba(255,210,80,.9)', border:'1px solid rgba(255,200,50,.3)' }}>✦ VIP เข้าห้อง ✦</span>
                : <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(155,81,224,.7)' }}>เข้าสู่ห้อง</span>
              }
            </motion.div>
            <motion.h2 initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:.2, type:'spring', stiffness:200 }}
              style={{ fontWeight:900, letterSpacing:'.03em', lineHeight:1, marginBottom:8, fontSize:'clamp(1.4rem,3vw,2rem)', background: isVIP?'linear-gradient(135deg,#fff 0%,#ffd700 40%,#ff80ff 70%,#fff 100%)':'linear-gradient(135deg,#fff,rgba(155,81,224,.9))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter: isVIP?'drop-shadow(0 0 12px rgba(255,200,50,.8))':'drop-shadow(0 0 8px rgba(155,81,224,.8))' }}>
              {item.displayName}
            </motion.h2>
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35 }} style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ padding:'4px 12px', borderRadius:99, fontSize:14, fontWeight:900, ...(isVIP?{ background:'linear-gradient(135deg,rgba(255,180,30,.9),rgba(220,80,255,.8))', color:'#fff', boxShadow:'0 0 14px rgba(255,180,30,.8),0 0 28px rgba(220,80,255,.4)', border:'1px solid rgba(255,220,80,.4)' }:{ background:'linear-gradient(135deg,rgba(155,81,224,.9),rgba(236,72,153,.7))', color:'#fff', boxShadow:'0 0 12px rgba(155,81,224,.7)' }) }}>
                {isVIP?'⭐':'🏅'} LV. {item.level||0}
              </span>
              {isVIP && <motion.span style={{ fontSize:13, fontWeight:700, color:'rgba(255,210,80,.9)' }} animate={{ opacity:[1,.6,1] }} transition={{ duration:1.2, repeat:Infinity }}>✨ ราชาผู้ยิ่งใหญ่ ✨</motion.span>}
            </motion.div>
          </div>
        </div>

        <motion.div style={{ position:'absolute', bottom:0, left:0, right:0, height:1, background: isVIP?'linear-gradient(to right,transparent,rgba(255,200,50,.8),rgba(255,80,255,.8),transparent)':'linear-gradient(to right,transparent,rgba(155,81,224,.6),transparent)' }} animate={{ opacity:[.5,1,.5] }} transition={{ duration:2, repeat:Infinity }} />
      </div>
      <VIPParticles isVIP={isVIP} />
    </motion.div>
  );
}

function VIPParticles({ isVIP }) {
  const count  = isVIP ? 16 : 8;
  const colors = isVIP ? ['rgba(255,200,50,1)','rgba(255,100,255,1)','rgba(200,130,255,1)','rgba(255,255,150,1)'] : ['rgba(155,81,224,1)','rgba(236,72,153,1)','rgba(200,150,255,1)'];
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:3 }}>
      {[...Array(count)].map((_,i) => {
        const color=colors[i%colors.length], size=isVIP?4+(i%3)*2:2+(i%3);
        const angle=(i/count)*360, dist=80+(i%4)*30;
        const dx=Math.cos(angle*Math.PI/180)*dist, dy=Math.sin(angle*Math.PI/180)*dist;
        return (
          <motion.div key={i} style={{ position:'absolute', left:60, top:50, width:size, height:size, borderRadius:'50%', background:color, boxShadow:`0 0 ${size*3}px ${color}` }}
            initial={{ x:0, y:0, scale:0, opacity:0 }} animate={{ x:[0,dx*.5,dx], y:[0,dy*.5-30,dy-40], scale:[0,1.5,0], opacity:[0,1,0] }}
            transition={{ duration:1.5+(i%4)*.25, delay:.2+(i%5)*.1, repeat:Infinity, repeatDelay:(i%3)*.7, ease:'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/* ── Gift Card (overlay) ── */
function GiftCard({ item, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ x:-400, opacity:0, scale:.75 }} animate={{ x:0, opacity:1, scale:1 }} exit={{ x:-400, opacity:0, scale:.8, filter:'blur(8px)' }} transition={{ type:'spring', stiffness:200, damping:22 }} style={{ position:'relative', width:'100%', maxWidth:500 }}>
      <div style={{ position:'absolute', inset:-16, borderRadius:24, pointerEvents:'none', background:'radial-gradient(ellipse,rgba(236,72,153,.3) 0%,transparent 70%)', filter:'blur(15px)', animation:'divineBreath 1.8s ease-in-out infinite' }} />
      <div style={{ position:'relative', overflow:'hidden', borderRadius:16, border:'2px solid rgba(236,72,153,.65)', backdropFilter:'blur(24px)', background:'linear-gradient(135deg,rgba(40,5,30,.97) 0%,rgba(60,10,45,.97) 100%)', boxShadow:'0 0 30px rgba(236,72,153,.5),0 0 60px rgba(180,40,120,.25),inset 0 1px 0 rgba(255,100,200,.15)' }}>
        <motion.div style={{ position:'absolute', top:0, left:0, height:2, borderRadius:99, background:'linear-gradient(to right,transparent,rgba(255,80,180,1),rgba(255,150,255,1),transparent)' }} initial={{ width:'0%', left:'50%' }} animate={{ width:'100%', left:'0%' }} transition={{ duration:.5, ease:'easeOut' }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:.1, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)' }} />
        <div style={{ position:'relative', padding:16, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(236,72,153,.8)', boxShadow:'0 0 16px rgba(236,72,153,.8),0 0 32px rgba(180,40,120,.4)', flexShrink:0 }}>
            {item.profilePicUrl ? <img src={item.profilePicUrl} alt={item.displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(180,30,100,.4)' }}><span style={{ color:'#ffaad4', fontWeight:900, fontSize:22 }}>{(item.displayName||'?')[0].toUpperCase()}</span></div>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:10, fontWeight:900, letterSpacing:'.25em', textTransform:'uppercase', color:'rgba(236,72,153,.8)', marginBottom:2 }}>🎁 ส่งของขวัญ</p>
            <h3 style={{ fontWeight:900, fontSize:20, lineHeight:1, marginBottom:8, background:'linear-gradient(135deg,#fff,#ff80d0)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', filter:'drop-shadow(0 0 8px rgba(255,80,180,.7))' }}>{item.displayName}</h3>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ padding:'4px 12px', borderRadius:99, fontSize:14, fontWeight:900, background:'linear-gradient(135deg,rgba(236,72,153,.9),rgba(180,40,120,.9))', boxShadow:'0 0 12px rgba(236,72,153,.7)', color:'#fff' }}>🎁 {item.giftName||'ของขวัญ'}</span>
              {item.repeatCount>1 && <span style={{ padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:900, background:'rgba(180,30,100,.5)', color:'#ffaad4', border:'1px solid rgba(236,72,153,.4)' }}>×{item.repeatCount}</span>}
              {item.diamonds>0 && <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,160,220,.8)' }}>💎 {item.diamonds.toLocaleString()}</span>}
            </div>
          </div>
        </div>
        <motion.div style={{ position:'absolute', bottom:0, left:0, right:0, height:1, background:'linear-gradient(to right,transparent,rgba(255,80,180,.7),transparent)' }} animate={{ opacity:[.4,1,.4] }} transition={{ duration:1.8, repeat:Infinity }} />
      </div>
      <GiftParticles />
    </motion.div>
  );
}

function GiftParticles() {
  const emojis = ['🎁','💎','✨','⭐','🌟','💫'];
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:3 }}>
      {[...Array(8)].map((_,i) => (
        <motion.div key={i} style={{ position:'absolute', left:40, top:40, fontSize:18 }}
          initial={{ x:0, y:0, scale:0, opacity:0, rotate:0 }}
          animate={{ x:(i%2===0?1:-1)*(60+i*12), y:-(60+i*10), scale:[0,1.2,0], opacity:[0,1,0], rotate:(i%2===0?1:-1)*90 }}
          transition={{ duration:1.2+(i%4)*.2, delay:.1+i*.08, repeat:Infinity, repeatDelay:(i%3)*.8, ease:'easeOut' }}
        >{emojis[i%emojis.length]}</motion.div>
      ))}
    </div>
  );
}
