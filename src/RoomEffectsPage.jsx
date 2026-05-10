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

  const feedRef  = useRef(null);
  const autoRef  = useRef(true);
  const [events, setEvents]   = useState([]);
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

  /* ── socket wiring ── */
  function wireSocket(sock) {
    sock.on('tiktokConnected',    ()    => setStatus('live'));
    sock.on('tiktokDisconnected', (msg) => { setStatus('error'); setErrMsg(msg || 'ตัดการเชื่อมต่อ'); });
    sock.on('roomUser', d => { if (typeof d?.viewerCount === 'number') setViewers(d.viewerCount); });
    sock.on('like',     d => { if (typeof d?.totalLikeCount === 'number') setLikes(d.totalLikeCount); });

    const push = item => setEvents(prev => {
      const next = [...prev, item];
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });

    sock.on('member', d => push({ id:mkid(), type:'join',   uniqueId:d.uniqueId||'?', displayName:d.displayName||d.uniqueId||'?', profilePicUrl:d.profilePicUrl||null, text:'เข้าร่วมห้อง', level:d.level||0 }));
    sock.on('chat',   d => push({ id:mkid(), type:'chat',   uniqueId:d.uniqueId,      displayName:d.displayName,                   profilePicUrl:d.profilePicUrl,        text:d.comment }));
    sock.on('follow', d => push({ id:mkid(), type:'follow', uniqueId:d.uniqueId,      displayName:d.displayName,                   profilePicUrl:d.profilePicUrl,        text:'กดติดตาม' }));
    sock.on('share',  d => push({ id:mkid(), type:'share',  uniqueId:d.uniqueId,      displayName:d.displayName,                   profilePicUrl:d.profilePicUrl,        text:'แชร์ไลฟ์' }));
    sock.on('like',   d => { if (d?.likeCount > 0) push({ id:mkid(), type:'like', uniqueId:d.uniqueId||'?', displayName:d.displayName||'?', profilePicUrl:d.profilePicUrl||null, text:`ไลค์ ${d.likeCount} ครั้ง` }); });
    sock.on('gift',   d => {
      setDiamonds(prev => prev + (d.diamonds || 0));
      push({ id:mkid(), type:'gift', uniqueId:d.uniqueId, displayName:d.displayName, profilePicUrl:d.profilePicUrl||null, text:`🎁 ${d.giftName||'ของขวัญ'}${d.repeatCount>1?' ×'+d.repeatCount:''}`, diamonds:d.diamonds||0 });
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
    { icon:'⚡', label:'เหตุการณ์',  value: events.length,                    color:'#8b5cf6' },
    { icon:'🎁', label:'ของขวัญ',    value: events.filter(e=>e.type==='gift').length, color:'#f472b6' },
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
        input::placeholder{color:rgba(180,160,230,.35)}
        input:focus{outline:none}
      `}</style>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

        {/* ══ SIDEBAR ══ */}
        <aside style={{ width:156, flexShrink:0, background:'#0f0e1a', borderRight:'1px solid rgba(139,92,246,.14)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* logo */}
          <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid rgba(139,92,246,.1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🎮</div>
              <span style={{ fontWeight:900, fontSize:14, letterSpacing:'0.1em', color:'#e2e0ff' }}>ROOM FX</span>
            </div>
          </div>
          {/* nav */}
          <nav style={{ flex:1, padding:'12px 8px' }}>
            {[
              { id:'dashboard', icon:'⊞', label:'แดชบอร์ด' },
              { id:'settings',  icon:'⚙', label:'การตั้งค่า' },
            ].map(item => (
              <button key={item.id} onClick={() => setNavTab(item.id)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'9px 10px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:4, transition:'all .15s',
                  background: navTab===item.id ? 'rgba(139,92,246,.18)' : 'transparent',
                  color: navTab===item.id ? '#a78bfa' : 'rgba(160,150,200,.5)',
                  fontWeight: navTab===item.id ? 700 : 500, fontSize:13 }}>
                <span style={{ fontSize:14 }}>{item.icon}</span>
                {item.label}
                {navTab===item.id && <span style={{ marginLeft:'auto', width:4, height:4, borderRadius:'50%', background:'#a78bfa', flexShrink:0 }} />}
              </button>
            ))}
          </nav>
          {/* server status */}
          <div style={{ padding:'12px 14px', borderTop:'1px solid rgba(139,92,246,.1)', display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: statDot, flexShrink:0, animation: isLive?'pulse-live 1.8s infinite':undefined }} />
            <span style={{ fontSize:11, color:'rgba(160,150,200,.55)', lineHeight:1.3 }}>{isLive ? 'เซิร์ฟเวอร์เชื่อมต่อแล้ว' : statTxt}</span>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'#0b0b14' }}>

          {/* ─ page header ─ */}
          <div style={{ padding:'20px 28px 0', flexShrink:0 }}>
            <div style={{ fontSize:24, fontWeight:900, letterSpacing:'0.06em', color:'#f0eeff' }}>
              {navTab === 'dashboard' ? 'DASHBOARD' : 'การตั้งค่า'}
            </div>
            <div style={{ fontSize:12, color:'rgba(160,150,200,.5)', marginTop:2 }}>
              {navTab === 'dashboard' ? 'ควบคุม TikTok LIVE แบบเรียลไทม์' : 'ตั้งค่า Overlay สำหรับ OBS / TikTok Live Studio'}
            </div>
          </div>

          {/* ─ DASHBOARD TAB ─ */}
          {navTab === 'dashboard' && (
            <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden', padding:'16px 28px 20px' }}>

              {/* top row: connect card + stat cards */}
              <div style={{ display:'flex', gap:14, flexShrink:0, marginBottom:16 }}>

                {/* connect card */}
                <div style={{ flex:'1 1 0', minWidth:0, background:'#16152a', border:'1px solid rgba(139,92,246,.18)', borderRadius:14, padding:'20px 22px' }}>
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
                      <button onClick={connect} disabled={!username.trim()} style={{ background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:10, color:'#fff', padding:'11px 24px', fontSize:14, fontWeight:700, cursor:'pointer', opacity:username.trim()?1:.45, display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' }}>
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
                </div>

                {/* stat cards */}
                {statCards.map(s => (
                  <div key={s.label} style={{ flex:'0 0 130px', background:'#16152a', border:'1px solid rgba(139,92,246,.14)', borderRadius:14, padding:'16px 18px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:`${s.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize:22, fontWeight:900, color:s.color, lineHeight:1, marginBottom:3 }}>{s.value}</div>
                      <div style={{ fontSize:11, color:'rgba(160,150,200,.5)', fontWeight:600 }}>{s.label}</div>
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
                      style={{ background: eventFilter===f.key ? 'rgba(139,92,246,.22)' : 'rgba(139,92,246,.06)', border:`1px solid ${eventFilter===f.key?'rgba(139,92,246,.5)':'rgba(139,92,246,.12)'}`, borderRadius:20, color: eventFilter===f.key?'#c4b5fd':'rgba(160,150,200,.5)', fontSize:12, fontWeight:600, padding:'4px 12px', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}>
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
                    <div key={item.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 8px', borderRadius:8, marginBottom:2, transition:'background .1s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(139,92,246,.06)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
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

          {/* ─ SETTINGS TAB ─ */}
          {navTab === 'settings' && (
            <div style={{ flex:1, overflow:'auto', padding:'20px 28px' }}>
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
