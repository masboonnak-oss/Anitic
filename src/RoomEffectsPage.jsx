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
        @keyframes kingPulse{0%{box-shadow:0 0 50px rgba(255,190,30,.7),0 0 100px rgba(220,80,255,.4)}50%{box-shadow:0 0 80px rgba(255,190,30,1),0 0 160px rgba(220,80,255,.7),0 0 240px rgba(255,130,0,.3)}100%{box-shadow:0 0 50px rgba(255,190,30,.7),0 0 100px rgba(220,80,255,.4)}}
        @keyframes lightningFlash{0%,100%{opacity:0}10%,30%{opacity:1}20%,40%{opacity:.3}}
        @keyframes ringOut{0%{transform:translate(-50%,-50%) scale(0);opacity:.8}100%{transform:translate(-50%,-50%) scale(4);opacity:0}}
        input::placeholder{color:rgba(180,160,230,.35)}
        input:focus{outline:none}
        .re-sidebar{width:156px;flex-shrink:0}
        .re-page-header{padding:20px 28px 0;flex-shrink:0}
        .re-dash-content{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:16px 28px 20px}
        .re-settings-content{flex:1;overflow:auto;padding:20px 28px}
        .re-top-row{display:flex;gap:14px;flex-shrink:0;margin-bottom:16px}
        @media(max-width:640px){
          .re-sidebar{width:44px}
          .re-logo-text,.re-nav-label,.re-status-text{display:none}
          .re-page-header{padding:12px 12px 0}
          .re-dash-content{padding:10px 10px 12px}
          .re-settings-content{padding:12px}
          .re-top-row{flex-direction:column;gap:10px}
        }
      `}</style>

      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

        {/* ══ SIDEBAR ══ */}
        <aside className="re-sidebar" style={{ background:'#0f0e1a', borderRight:'1px solid rgba(139,92,246,.14)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
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
                style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'9px 10px', borderRadius:8, border:'none', cursor:'pointer', marginBottom:4, transition:'all .15s',
                  background: navTab===item.id ? 'rgba(139,92,246,.18)' : 'transparent',
                  color: navTab===item.id ? '#a78bfa' : 'rgba(160,150,200,.5)',
                  fontWeight: navTab===item.id ? 700 : 500, fontSize:13 }}>
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
          <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(139,92,246,.1)', marginTop:8, display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: statDot, flexShrink:0, animation: isLive?'pulse-live 1.8s infinite':undefined }} />
            <span className="re-status-text" style={{ fontSize:11, color:'rgba(160,150,200,.55)', lineHeight:1.3 }}>{isLive ? 'เซิร์ฟเวอร์เชื่อมต่อแล้ว' : statTxt}</span>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', background:'#0b0b14' }}>

          {/* ─ page header ─ */}
          <div className="re-page-header">
            <div style={{ fontSize:24, fontWeight:900, letterSpacing:'0.06em', color:'#f0eeff' }}>
              {navTab === 'dashboard' ? 'DASHBOARD' : navTab === 'visitors' ? 'ผู้เยี่ยมชม' : 'การตั้งค่า'}
            </div>
            <div style={{ fontSize:12, color:'rgba(160,150,200,.5)', marginTop:2 }}>
              {navTab === 'dashboard' ? 'ควบคุม TikTok LIVE แบบเรียลไทม์' : navTab === 'visitors' ? 'บันทึกชื่อ รูป เลเวล ใจ และเพชรของผู้ชม' : 'ตั้งค่า Overlay สำหรับ OBS / TikTok Live Studio'}
            </div>
          </div>

          {/* ─ DASHBOARD TAB ─ */}
          {navTab === 'dashboard' && (
            <div className="re-dash-content">

              {/* top row: connect card + stat cards */}
              <div className="re-top-row">

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

          {/* ─ VISITORS TAB ─ */}
          {navTab === 'visitors' && (
            <div className="re-dash-content" style={{ display:'flex', flexDirection:'column', gap:14, height:'100%', overflow:'hidden' }}>
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
                <div style={{ display:'grid', gridTemplateColumns:'2.8fr 0.6fr 0.8fr 0.8fr 0.8fr', gap:0, padding:'10px 16px', borderBottom:'1px solid rgba(139,92,246,.1)', flexShrink:0 }}>
                  {['ชื่อ / username','เลเวล','❤️ ใจ','💎 เพชร','เข้าล่าสุด'].map((h,i) => (
                    <span key={i} style={{ fontSize:11, fontWeight:700, color:'rgba(160,150,200,.45)', letterSpacing:'.05em', textAlign: i===0?'left':'right' }}>{h}</span>
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
                      <div key={v.unique_id}
                        style={{ display:'grid', gridTemplateColumns:'2.8fr 0.6fr 0.8fr 0.8fr 0.8fr', gap:0,
                          padding:'7px 16px', borderBottom:'1px solid rgba(139,92,246,.05)', transition:'background .1s',
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
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
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
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', fontSize:11, color:'rgba(160,150,200,.4)' }}>
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

function addToQueue(prev, item) {
  const next = [...prev, item];
  return next.length > 3 ? next.slice(next.length - 3) : next;
}

function OverlayView() {
  const [queue, setQueue] = useState(IS_DEMO ? [DEMO_ITEM] : []);
  const [flash, setFlash] = useState(false);
  const [kingAnnounce, setKingAnnounce] = useState(null);
  const uidRef = useRef(0);
  const mkid   = () => `${Date.now()}-${++uidRef.current}`;

  // ── Self-cleaning timer registry (กัน leak ตอนรันยาวบน VPS) ──
  const timersRef = useRef(new Set());
  const setTrackedTimeout = (fn, ms) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
    return id;
  };

  // ── Announce queue (serialize tier 4+ จัดเรียงทีละคน) ──
  const announceQueueRef = useRef([]);
  const announceBusyRef  = useRef(false);
  const processAnnounceQueue = () => {
    if (announceBusyRef.current) return;
    const next = announceQueueRef.current.shift();
    if (!next) return;
    announceBusyRef.current = true;
    setKingAnnounce({ id: mkid(), displayName: next.displayName, tierId: next.tierId });
    setTrackedTimeout(() => setQueue(prev => addToQueue(prev, next.item)), 2600);
    setTrackedTimeout(() => {
      setKingAnnounce(null);
      announceBusyRef.current = false;
      setTrackedTimeout(processAnnounceQueue, 350);
    }, 3200);
  };
  const enqueueAnnounce = (displayName, tierId, item) => {
    announceQueueRef.current.push({ displayName, tierId, item });
    processAnnounceQueue();
  };

  // DEMO mode: trigger announcer for tier 4+ (ผ่าน queue)
  useEffect(() => {
    if (!IS_DEMO) return;
    const demoTier = getTier(DEMO_ITEM.level || 0);
    if (!demoTier.hasAnnounce) return;
    const fire = () => enqueueAnnounce(DEMO_ITEM.displayName, demoTier.id, { ...DEMO_ITEM, _uid: mkid() });
    const t = setTimeout(fire, 600);
    const iv = setInterval(fire, demoTier.displayMs + 1500);
    return () => {
      clearTimeout(t); clearInterval(iv);
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!overlaySock) return;

    function onMember(data) {
      const lv = data.level || 0;
      const tier = getTier(lv);
      // flash เฉพาะ tier 3+ (ELITE ขึ้น)
      if (tier.id >= 3) { setFlash(true); setTrackedTimeout(() => setFlash(false), 800); }
      const item = {
        _uid: mkid(), variant: 'join',
        uniqueId: data.uniqueId, displayName: data.displayName || data.uniqueId || '?',
        profilePicUrl: data.profilePicUrl || null, level: lv,
      };
      // KING/LEGEND announcement (tier 4+) — serialize ผ่าน queue, การ์ดตามมา
      if (tier.hasAnnounce) {
        enqueueAnnounce(item.displayName, tier.id, item);
      } else {
        setQueue(prev => addToQueue(prev, item));
      }
    }
    function onGift(data) {
      setQueue(prev => addToQueue(prev, {
        _uid: mkid(), variant: 'gift',
        uniqueId: data.uniqueId, displayName: data.displayName || data.uniqueId || '?',
        profilePicUrl: data.profilePicUrl || null,
        giftName: data.giftName, repeatCount: data.repeatCount || 1, diamonds: data.diamonds || 0,
      }));
    }

    overlaySock.on('tiktokMember', onMember);
    overlaySock.on('tiktokGift',   onGift);

    return () => {
      overlaySock.off('tiktokMember', onMember);
      overlaySock.off('tiktokGift',   onGift);
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
      announceQueueRef.current = [];
      announceBusyRef.current = false;
    };
  }, []);

  function dismiss(uid) {
    setQueue(prev => prev.filter(q => q._uid !== uid));
    // ใน DEMO mode → re-spawn ทันทีเพื่อให้ดูได้ตลอด
    if (IS_DEMO) setTrackedTimeout(() => setQueue([{ ...DEMO_ITEM, _uid: mkid() }]), 400);
  }
  const isPreview = params.has('preview');

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
            initial={{ opacity:0 }} animate={{ opacity:[0,.8,.4,0] }}
            transition={{ duration:.8, times:[0,.08,.4,1] }}
            style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:40,
              background:'radial-gradient(ellipse at center,rgba(255,200,50,0.6) 0%,rgba(200,80,255,0.4) 40%,transparent 70%)' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {kingAnnounce && <KingAnnouncement key={kingAnnounce.id} name={kingAnnounce.displayName} tierId={kingAnnounce.tierId} />}
      </AnimatePresence>

      {/* ── Preview label (hidden in actual OBS mode) ── */}
      {isPreview && (
        <div style={{ position:'fixed', top:16, left:16, right:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, zIndex:50 }}>
          <div style={{ background:'rgba(10,0,20,.88)', border:'1px solid rgba(155,81,224,.35)', borderRadius:10, padding:'7px 14px', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(155,81,224,.8)', letterSpacing:'.15em' }}>👁 PREVIEW</span>
            {OVERLAY_USER && <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>@{OVERLAY_USER}</span>}
          </div>
          <div style={{ background:'rgba(10,0,20,.82)', border:'1px solid rgba(100,80,150,.2)', borderRadius:9, padding:'6px 12px', fontSize:10, color:'rgba(180,160,220,.4)' }}>
            OBS Browser Source: ลบ ?preview ออกจาก URL
          </div>
        </div>
      )}

      <div style={{ position:'fixed', bottom:32, left:32, display:'flex', flexDirection:'column', alignItems:'flex-start', gap:16, pointerEvents:'none', zIndex:50, maxWidth:960, width:'calc(100vw - 64px)' }}>
        <AnimatePresence>
          {queue.map(item => item.variant === 'gift'
            ? <GiftCard  key={item._uid} item={item} onDone={() => dismiss(item._uid)} />
            : <VIPCard   key={item._uid} item={item} onDone={() => dismiss(item._uid)} />
          )}
        </AnimatePresence>
      </div>

      {isPreview && queue.length === 0 && (
        <div style={{ position:'fixed', bottom:32, left:32, background:'rgba(10,0,20,.75)', border:'1px dashed rgba(155,81,224,.25)', borderRadius:12, padding:'16px 22px', backdropFilter:'blur(12px)', maxWidth:360 }}>
          <div style={{ fontSize:12, color:'rgba(155,81,224,.45)' }}>
            🎭 รอรับ events จาก Dashboard... (overlay passive mode)
          </div>
        </div>
      )}
    </>
  );
}

/* ── King/Legend Cinematic Announcement (full-screen) ── */
function KingAnnouncement({ name, tierId = 4 }) {
  const isLegend = tierId >= 5;
  const titleText = isLegend ? 'LEGEND มาแล้ว!' : 'KING เข้าห้อง!';
  const crown = isLegend ? '⚜️' : '👑';
  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:[0,1,1,1,0] }}
      transition={{ duration:3.2, times:[0,.08,.45,.75,1] }}
      style={{ position:'fixed', inset:0, zIndex:200, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse at center,rgba(255,160,0,.18) 0%,rgba(140,0,220,.12) 50%,transparent 70%)' }}
    >
      {/* cinematic bars */}
      <motion.div initial={{ scaleY:0 }} animate={{ scaleY:[0,1,1,0] }} transition={{ duration:3.2, times:[0,.06,.9,1] }}
        style={{ position:'absolute', top:0, left:0, right:0, height:60, background:'linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,0))', transformOrigin:'top' }} />
      <motion.div initial={{ scaleY:0 }} animate={{ scaleY:[0,1,1,0] }} transition={{ duration:3.2, times:[0,.06,.9,1] }}
        style={{ position:'absolute', bottom:0, left:0, right:0, height:60, background:'linear-gradient(to top,rgba(0,0,0,.9),rgba(0,0,0,0))', transformOrigin:'bottom' }} />

      {/* shockwave rings */}
      {[0,.15,.3].map((d,i) => (
        <div key={i} style={{ position:'absolute', top:'50%', left:'50%', width:100, height:100, borderRadius:'50%',
          border:`2px solid ${i===0?'rgba(255,200,50,.8)':i===1?'rgba(220,80,255,.6)':'rgba(100,200,255,.5)'}`,
          animation:`ringOut 1.4s ${d}s ease-out forwards`, pointerEvents:'none' }} />
      ))}

      {/* main content */}
      <motion.div initial={{ scale:.2, opacity:0, y:30 }}
        animate={{ scale:[.2,1.15,1,.98,1], opacity:[0,1,1,1,0] }}
        transition={{ duration:3.2, times:[0,.12,.3,.5,1] }}
        style={{ textAlign:'center', position:'relative', zIndex:5 }}>

        {/* crown drop */}
        <motion.div initial={{ y:-120, opacity:0, scale:3 }} animate={{ y:[-120,0,-12,0], opacity:[0,1,1,1,0] }}
          transition={{ duration:3.2, times:[0,.15,.35,.6,1] }}
          style={{ fontSize:'clamp(80px,9vw,170px)', lineHeight:1,
            filter: isLegend
              ? 'drop-shadow(0 0 60px rgba(128,232,255,1)) drop-shadow(0 0 110px rgba(255,128,255,.8))'
              : 'drop-shadow(0 0 60px rgba(255,200,0,1)) drop-shadow(0 0 110px rgba(255,150,0,.7))' }}>
          {crown}
        </motion.div>

        {/* TITLE text */}
        <motion.div initial={{ letterSpacing:'0.8em', opacity:0 }} animate={{ letterSpacing:['0.8em','0.08em','0.08em','0.08em','0.3em'], opacity:[0,1,1,1,0] }}
          transition={{ duration:3.2, times:[0,.18,.4,.7,1] }}
          style={{ fontSize:'clamp(50px,8vw,140px)', fontWeight:900, lineHeight:1,
            background: isLegend
              ? 'linear-gradient(135deg,#fff 0%,#80e8ff 25%,#ff80ff 50%,#ffd700 75%,#fff 100%)'
              : 'linear-gradient(135deg,#fff8e0 0%,#ffd700 25%,#ff80ff 60%,#80cfff 80%,#fff 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            filter: isLegend
              ? 'drop-shadow(0 0 30px rgba(128,232,255,1)) drop-shadow(0 0 60px rgba(255,128,255,.8))'
              : 'drop-shadow(0 0 30px rgba(255,200,50,1)) drop-shadow(0 0 60px rgba(220,80,255,.7))',
            marginTop:8 }}>
          {titleText}
        </motion.div>

        {/* name */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:[0,1,1,0], y:[20,0,0,0] }}
          transition={{ duration:3.2, times:[0,.25,.7,1] }}
          style={{ fontSize:'clamp(28px,4vw,60px)', fontWeight:800, color: isLegend?'rgba(220,250,255,.98)':'rgba(255,225,100,.98)', marginTop:18,
            filter: isLegend?'drop-shadow(0 0 18px rgba(128,232,255,.9))':'drop-shadow(0 0 18px rgba(255,200,50,.9))', letterSpacing:'.04em' }}>
          {name}
        </motion.div>

        {/* subtitle */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:[0,.8,.8,0] }} transition={{ duration:3.2, times:[0,.3,.7,1] }}
          style={{ fontSize:'clamp(16px,2.2vw,32px)', fontWeight:700, color: isLegend?'rgba(180,230,255,.9)':'rgba(255,200,140,.9)', marginTop:12, letterSpacing:'.28em', textTransform:'uppercase' }}>
          {isLegend ? '⚜ ตำนานแห่งห้อง ⚜' : '✦ ราชาผู้ยิ่งใหญ่ ✦'}
        </motion.div>
      </motion.div>

      {/* side light beams */}
      {[-1,1].map(dir => (
        <motion.div key={dir} initial={{ scaleX:0, opacity:0 }} animate={{ scaleX:[0,1,1,0], opacity:[0,.8,.8,0] }}
          transition={{ duration:3.2, times:[0,.12,.7,1] }}
          style={{ position:'absolute', top:'50%', [dir>0?'left':'right']:'50%', width:'50%', height:3,
            background:`linear-gradient(${dir>0?'to right':'to left'},rgba(255,200,50,.9),rgba(220,80,255,.6),transparent)`,
            transformOrigin: dir>0 ? 'left center' : 'right center' }} />
      ))}
    </motion.div>
  );
}

/* ── TIER SYSTEM: ทุก effect ผูกกับ level จาก chat ──
   Tier 1 (0-4)   NEWBIE  : ขาว/เทา card เล็ก minimal 4s
   Tier 2 (5-14)  MEMBER  : ฟ้าน้ำเงิน glow + small particles 5s
   Tier 3 (15-19) ELITE   : ม่วง/ชมพู orbit + sparkles 6s
   Tier 4 (20-29) KING    : ทอง full effect + KING announce 8s
   Tier 5 (30+)   LEGEND  : rainbow MAX effect + LEGEND announce 9s
─────────────────────────────────────────────────────────── */
function getTier(level) {
  const lv = level || 0;
  if (lv >= 30) return {
    id:5, name:'LEGEND', label:'✦ LEGEND ✦', subtitle:'⚜ ตำนานแห่งห้อง ⚜',
    avatarSize:148, displayMs:9000, maxWidth:920,
    primary:'#80e8ff', secondary:'#ff80ff', accent:'#ffd700',
    cardBg:'linear-gradient(135deg,rgba(8,30,52,.98) 0%,rgba(48,10,68,.98) 50%,rgba(52,8,30,.98) 100%)',
    border:'2.5px solid rgba(128,232,255,.95)',
    boxShadow:'0 0 70px rgba(128,232,255,.7),0 0 140px rgba(255,128,255,.5),0 0 240px rgba(255,215,0,.3),inset 0 1.5px 0 rgba(255,255,255,.4)',
    nameGradient:'linear-gradient(135deg,#fff 0%,#80e8ff 25%,#ff80ff 50%,#ffd700 75%,#fff 100%)',
    badgeGradient:'linear-gradient(135deg,rgba(128,232,255,.4),rgba(255,128,255,.4))',
    badgeColor:'rgba(220,250,255,1)', badgeBorder:'1.5px solid rgba(128,232,255,.7)',
    levelGradient:'linear-gradient(135deg,rgba(128,232,255,1),rgba(255,128,255,.95),rgba(255,215,0,.9))',
    rays:20, hasOrbit:true, hasCrown:true, hasLightning:true, hasParticles:'mega', hasAnnounce:true, hasSpeedTrail:true,
    avatarBoxShadow:'0 0 32px rgba(128,232,255,1),0 0 64px rgba(255,128,255,.8),0 0 110px rgba(255,215,0,.5)',
  };
  if (lv >= 20) return {
    id:4, name:'KING', label:'✦ KING VIP ✦', subtitle:'✨ ราชาผู้ยิ่งใหญ่ ✨',
    avatarSize:140, displayMs:8000, maxWidth:880,
    primary:'#ffd700', secondary:'#ff80ff', accent:'#ffb43c',
    cardBg:'linear-gradient(135deg,rgba(18,5,42,.98) 0%,rgba(48,10,68,.98) 45%,rgba(18,5,35,.98) 100%)',
    border:'2.5px solid rgba(255,190,30,.9)',
    boxShadow:'0 0 60px rgba(255,190,30,.65),0 0 120px rgba(200,80,255,.45),0 0 220px rgba(255,120,0,.2),inset 0 1.5px 0 rgba(255,220,80,.35)',
    nameGradient:'linear-gradient(135deg,#fff8d0 0%,#ffd700 30%,#ff80ff 60%,#80e8ff 80%,#fffacc 100%)',
    badgeGradient:'linear-gradient(135deg,rgba(255,180,30,.35),rgba(220,80,255,.35))',
    badgeColor:'rgba(255,215,80,1)', badgeBorder:'1.5px solid rgba(255,200,50,.6)',
    levelGradient:'linear-gradient(135deg,rgba(255,180,30,1),rgba(220,80,255,.9))',
    rays:16, hasOrbit:true, hasCrown:true, hasLightning:true, hasParticles:'king', hasAnnounce:true, hasSpeedTrail:true,
    avatarBoxShadow:'0 0 30px rgba(255,180,30,1),0 0 60px rgba(255,100,255,.8),0 0 100px rgba(255,180,30,.4)',
  };
  if (lv >= 15) return {
    id:3, name:'ELITE', label:'★ ELITE ★', subtitle:'นักรบระดับสูง',
    avatarSize:108, displayMs:6500, maxWidth:720,
    primary:'#c084fc', secondary:'#f472b6', accent:'#a78bfa',
    cardBg:'linear-gradient(135deg,rgba(20,8,40,.97) 0%,rgba(40,12,55,.97) 100%)',
    border:'2px solid rgba(192,132,252,.75)',
    boxShadow:'0 0 40px rgba(192,132,252,.6),0 0 80px rgba(244,114,182,.35),inset 0 1px 0 rgba(192,132,252,.25)',
    nameGradient:'linear-gradient(135deg,#fff 0%,#f0abfc 50%,#a78bfa 100%)',
    badgeGradient:'linear-gradient(135deg,rgba(192,132,252,.3),rgba(244,114,182,.3))',
    badgeColor:'rgba(240,210,255,1)', badgeBorder:'1px solid rgba(192,132,252,.5)',
    levelGradient:'linear-gradient(135deg,rgba(192,132,252,.95),rgba(244,114,182,.85))',
    rays:0, hasOrbit:true, hasCrown:false, hasLightning:false, hasParticles:'elite', hasAnnounce:false, hasSpeedTrail:false,
    avatarBoxShadow:'0 0 22px rgba(192,132,252,.9),0 0 45px rgba(244,114,182,.45)',
  };
  if (lv >= 5) return {
    id:2, name:'MEMBER', label:'• MEMBER •', subtitle:'สมาชิก',
    avatarSize:88, displayMs:5000, maxWidth:600,
    primary:'#60a5fa', secondary:'#22d3ee', accent:'#3b82f6',
    cardBg:'linear-gradient(135deg,rgba(8,18,38,.95) 0%,rgba(12,28,52,.95) 100%)',
    border:'1.5px solid rgba(96,165,250,.55)',
    boxShadow:'0 0 24px rgba(96,165,250,.45),0 0 50px rgba(34,211,238,.2),inset 0 1px 0 rgba(96,165,250,.2)',
    nameGradient:'linear-gradient(135deg,#fff,#bae6fd 60%,#60a5fa)',
    badgeGradient:'linear-gradient(135deg,rgba(96,165,250,.25),rgba(34,211,238,.25))',
    badgeColor:'rgba(186,230,253,.95)', badgeBorder:'1px solid rgba(96,165,250,.4)',
    levelGradient:'linear-gradient(135deg,rgba(96,165,250,.9),rgba(34,211,238,.8))',
    rays:0, hasOrbit:false, hasCrown:false, hasLightning:false, hasParticles:'soft', hasAnnounce:false, hasSpeedTrail:false,
    avatarBoxShadow:'0 0 14px rgba(96,165,250,.75),0 0 28px rgba(34,211,238,.3)',
  };
  return {
    id:1, name:'NEWBIE', label:'· เข้าห้อง ·', subtitle:'ผู้มาเยือน',
    avatarSize:74, displayMs:4000, maxWidth:500,
    primary:'#cbd5e1', secondary:'#94a3b8', accent:'#e2e8f0',
    cardBg:'linear-gradient(135deg,rgba(15,15,28,.92) 0%,rgba(22,22,38,.92) 100%)',
    border:'1px solid rgba(203,213,225,.3)',
    boxShadow:'0 0 14px rgba(203,213,225,.2),inset 0 1px 0 rgba(203,213,225,.1)',
    nameGradient:'linear-gradient(135deg,#fff,#cbd5e1)',
    badgeGradient:'rgba(203,213,225,.15)',
    badgeColor:'rgba(226,232,240,.85)', badgeBorder:'1px solid rgba(203,213,225,.25)',
    levelGradient:'linear-gradient(135deg,rgba(148,163,184,.7),rgba(100,116,139,.6))',
    rays:0, hasOrbit:false, hasCrown:false, hasLightning:false, hasParticles:'none', hasAnnounce:false, hasSpeedTrail:false,
    avatarBoxShadow:'0 0 8px rgba(203,213,225,.4)',
  };
}

/* ── VIP Join Card — TIER-DRIVEN by level from chat ── */
function VIPCard({ item, onDone }) {
  const tier   = getTier(item.level || 0);
  const isKING = tier.id >= 4;
  useEffect(() => { const t = setTimeout(onDone, tier.displayMs); return () => clearTimeout(t); }, []);

  /* ── TIER-DRIVEN RENDER (ทุกอย่างขึ้นกับ level) ──────────── */
  const initX = tier.id >= 4 ? -1100 : tier.id >= 2 ? -500 : -300;
  const spring = tier.id >= 4
    ? { type:'spring', stiffness:240, damping:18, mass:.65 }
    : tier.id >= 2
      ? { type:'spring', stiffness:200, damping:18, mass:.8 }
      : { type:'spring', stiffness:260, damping:22, mass:.6 };

  return (
    <motion.div
      initial={{ x:initX, opacity:0, scale: isKING ? .5 : .8, skewX: isKING ? 8 : 0 }}
      animate={{ x:0, opacity:1, scale:1, skewX:0 }}
      exit={{ x:initX*.85, opacity:0, scale:.7, filter:'blur(12px)', transition:{ duration:.3 } }}
      transition={spring}
      style={{ position:'relative', width:'100%', maxWidth:tier.maxWidth, perspective:'1400px' }}
    >
      {/* speed trail (tier 4+) */}
      {tier.hasSpeedTrail && (
        <motion.div initial={{ scaleX:4, opacity:1 }} animate={{ scaleX:0, opacity:0 }}
          transition={{ duration:.45, ease:'easeOut' }}
          style={{ position:'absolute', right:'98%', top:'20%', bottom:'20%', width:350,
            background:`linear-gradient(to left,${tier.primary}aa,${tier.secondary}66,transparent)`,
            transformOrigin:'right center', borderRadius:'0 6px 6px 0', pointerEvents:'none' }} />
      )}

      {/* outer glow (tier 2+) */}
      {tier.id >= 2 && (
        <div style={{ position:'absolute', inset: isKING?-48:-18, borderRadius: isKING?32:22, pointerEvents:'none',
          background:`radial-gradient(ellipse,${tier.primary}${isKING?'80':'48'} 0%,${tier.secondary}${isKING?'59':'33'} 40%,transparent 70%)`,
          filter:`blur(${isKING?30:16}px)`, animation: isKING?'kingPulse 2s ease-in-out infinite':'divineBreath 2s ease-in-out infinite' }} />
      )}

      {/* light rays (tier 4+) */}
      {tier.rays > 0 && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:0 }}>
          {[...Array(tier.rays)].map((_,i) => {
            const colors = tier.id >= 5
              ? [`${tier.primary}f0`,`${tier.secondary}cc`,`${tier.accent}b0`,'rgba(255,255,255,.7)']
              : ['rgba(255,200,50,.95)','rgba(220,80,255,.8)','rgba(255,120,200,.7)','rgba(100,220,255,.6)'];
            return (
              <motion.div key={i}
                style={{ position:'absolute', left:tier.avatarSize/2-8, top:tier.avatarSize/2-2, width:520, height: i%3===0?3:2,
                  rotate:`${i*(360/tier.rays)}deg`, transformOrigin:'0 50%', borderRadius:99,
                  background:`linear-gradient(to right,${colors[i%4]},transparent)` }}
                initial={{ scaleX:0, opacity:0 }}
                animate={{ scaleX:[0,1,.65,1], opacity:[0,1,.55,.85] }}
                transition={{ duration:.55+i*.04, delay:.08, repeat:Infinity, repeatType:'reverse', repeatDelay:.2+i*.025 }}
              />
            );
          })}
        </div>
      )}

      {/* electric sparks (tier 4+) */}
      {tier.hasLightning && <KingLightning />}

      {/* card body */}
      <div style={{ position:'relative', overflow:'hidden',
        borderRadius: isKING ? 22 : tier.id >= 2 ? 16 : 12,
        border: tier.border, backdropFilter:'blur(24px)',
        background: tier.cardBg, boxShadow: tier.boxShadow,
        animation: isKING ? 'kingPulse 2s ease-in-out infinite' : 'none' }}>

        {/* top sweep */}
        <motion.div style={{ position:'absolute', top:0, left:0, height: isKING?3:2, borderRadius:99,
          background: isKING
            ? `linear-gradient(to right,transparent,${tier.primary},${tier.secondary},${tier.accent},${tier.primary},transparent)`
            : `linear-gradient(to right,transparent,${tier.primary},${tier.secondary},transparent)` }}
          initial={{ width:'0%', left:'50%' }} animate={{ width:'100%', left:'0%' }}
          transition={{ duration: isKING?.45:.6, ease:'easeOut' }} />

        {/* shimmer (tier 3+) */}
        {tier.id >= 3 && (
          <motion.div style={{ position:'absolute', inset:0, pointerEvents:'none',
            background:`linear-gradient(110deg,transparent 25%,${tier.primary}11 50%,transparent 75%)` }}
            animate={{ x:['-120%','220%'] }} transition={{ duration:2.8, repeat:Infinity, repeatDelay:1.2, ease:'linear' }} />
        )}

        {/* scanlines */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity: isKING?.07:.06,
          backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.18) 2px,rgba(0,0,0,.18) 4px)' }} />

        {/* corner brackets (tier 2+) */}
        {tier.id >= 2 && [{t:8,l:8,bt:'top',bl:'left'},{t:8,r:8,bt:'top',bl:'right'},{b:8,l:8,bt:'bottom',bl:'left'},{b:8,r:8,bt:'bottom',bl:'right'}].map((c,i) => {
          const sz = isKING ? 26 : tier.id >= 3 ? 20 : 16;
          const w  = isKING ? 3 : 2;
          return (
            <div key={i} style={{ position:'absolute', width:sz, height:sz, top:c.t, bottom:c.b, left:c.l, right:c.r,
              [`border${c.bt[0].toUpperCase()+c.bt.slice(1)}`]:`${w}px solid ${tier.primary}f0`,
              [`border${c.bl[0].toUpperCase()+c.bl.slice(1)}`]:`${w}px solid ${tier.primary}f0`,
              borderRadius: c.bt==='top'&&c.bl==='left'?'8px 0 0 0':c.bt==='top'&&c.bl==='right'?'0 8px 0 0':c.bt==='bottom'&&c.bl==='left'?'0 0 0 8px':'0 0 8px 0' }} />
          );
        })}

        <div style={{ position:'relative', padding: isKING?'22px':tier.id>=3?'18px':tier.id>=2?'14px':'11px 13px',
          display:'flex', alignItems:'center', gap: isKING?22:tier.id>=3?16:tier.id>=2?13:11, zIndex:2 }}>
          {/* avatar block */}
          <motion.div
            initial={{ scale:0, rotate: isKING?-240:tier.id>=2?-180:0 }}
            animate={{ scale:1, rotate:0 }}
            transition={{ type:'spring', stiffness: isKING?260:300, damping: isKING?17:20, delay: isKING?.1:.15 }}
            style={{ position:'relative', flexShrink:0 }}>

            {/* floating crown (tier 4+) */}
            {tier.hasCrown && (
              <motion.div style={{ position:'absolute', top:-28, left:'50%', transform:'translateX(-50%)', fontSize:30, zIndex:6,
                filter:`drop-shadow(0 0 16px ${tier.accent}) drop-shadow(0 0 32px ${tier.secondary}b0)` }}
                initial={{ y:-20, scale:0, opacity:0 }}
                animate={{ y:[0,-8,0], scale:[0,1.4,1], opacity:[0,1,1] }}
                transition={{ scale:{ duration:.3, delay:.25 }, opacity:{ duration:.25, delay:.25 }, y:{ duration:2.2, repeat:Infinity, ease:'easeInOut', delay:.3 } }}>
                {tier.id >= 5 ? '⚜️' : '👑'}
              </motion.div>
            )}

            {/* orbit rings (tier 3+) */}
            {tier.hasOrbit && (
              <>
                <motion.div style={{ position:'absolute', inset: isKING?-12:-6, borderRadius:'50%',
                  border:`2px dashed ${tier.primary}b0`, pointerEvents:'none' }}
                  animate={{ rotate:360 }} transition={{ duration: isKING?2.5:4, repeat:Infinity, ease:'linear' }} />
                {isKING && (
                  <motion.div style={{ position:'absolute', inset:-6, borderRadius:'50%',
                    border:`1.5px solid ${tier.secondary}80`, pointerEvents:'none' }}
                    animate={{ rotate:-360 }} transition={{ duration:1.8, repeat:Infinity, ease:'linear' }} />
                )}
              </>
            )}

            {/* avatar — รูปจาก chat */}
            <div style={{ width:tier.avatarSize, height:tier.avatarSize, borderRadius:'50%', overflow:'hidden',
              border:`${isKING?4:tier.id>=2?3:2}px solid ${tier.primary}`,
              boxShadow:tier.avatarBoxShadow, flexShrink:0 }}>
              {item.profilePicUrl
                ? <img src={item.profilePicUrl} alt={item.displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'} />
                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                    background:`linear-gradient(135deg,${tier.primary}66,${tier.secondary}55)` }}>
                    <span style={{ color: isKING?tier.accent:'#fff', fontWeight:900, fontSize: tier.avatarSize*.36 }}>{(item.displayName||'?')[0].toUpperCase()}</span>
                  </div>
              }
            </div>
          </motion.div>

          {/* text block */}
          <div style={{ flex:1, minWidth:0 }}>
            {/* tier badge */}
            <motion.div initial={{ opacity:0, x:-30 }} animate={{ opacity:1, x:0 }} transition={{ delay:.1 }}
              style={{ marginBottom: isKING?8:tier.id>=2?5:3 }}>
              <span style={{ fontSize: isKING?13:tier.id>=3?12:tier.id>=2?11:10, fontWeight:900,
                letterSpacing: isKING?'.35em':'.22em', textTransform:'uppercase',
                padding: isKING?'5px 16px':tier.id>=2?'4px 12px':'3px 10px', borderRadius:6,
                background: tier.badgeGradient, color: tier.badgeColor, border: tier.badgeBorder,
                boxShadow: isKING?`0 0 16px ${tier.primary}80,inset 0 0 12px ${tier.primary}26`:'none' }}>
                {tier.label}
              </span>
            </motion.div>

            {/* name */}
            <motion.h2 initial={{ opacity:0, x:-40 }} animate={{ opacity:1, x:0 }}
              transition={{ delay:.16, type:'spring', stiffness:220 }}
              style={{ fontWeight:900, letterSpacing:'.02em', lineHeight:1.1,
                marginBottom: isKING?12:tier.id>=2?8:5,
                fontSize: isKING ? 'clamp(2rem,3vw,3.4rem)' : tier.id>=3 ? 'clamp(1.55rem,2.3vw,2.4rem)' : tier.id>=2 ? 'clamp(1.25rem,1.8vw,1.85rem)' : 'clamp(1.05rem,1.4vw,1.45rem)',
                background: tier.nameGradient,
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                filter: isKING ? `drop-shadow(0 0 20px ${tier.primary}f0) drop-shadow(0 0 40px ${tier.secondary}99)` : tier.id>=2 ? `drop-shadow(0 0 8px ${tier.primary}c0)` : 'none' }}>
              {item.displayName}
            </motion.h2>

            {/* level + subtitle */}
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:.28 }}
              style={{ display:'flex', alignItems:'center', gap: isKING?10:7, flexWrap:'wrap' }}>
              <span style={{ padding: isKING?'6px 18px':tier.id>=2?'5px 14px':'3px 10px',
                borderRadius:99, fontSize: isKING?18:tier.id>=3?15:tier.id>=2?13:11, fontWeight:900,
                background: tier.levelGradient, color:'#fff',
                boxShadow: isKING ? `0 0 20px ${tier.primary}f0,0 0 40px ${tier.secondary}80` : tier.id>=2 ? `0 0 12px ${tier.primary}b0` : 'none',
                border: isKING ? `1px solid ${tier.accent}80` : 'none' }}>
                {tier.id>=4?'⭐':tier.id>=2?'🏅':'·'} LV. {item.level||0}
              </span>
              {tier.id >= 3 && (
                <motion.span style={{ fontSize: isKING?18:15, fontWeight:800, color: tier.badgeColor,
                  filter: isKING ? `drop-shadow(0 0 10px ${tier.primary}e0)` : 'none' }}
                  animate={ isKING ? { opacity:[1,.5,1], scale:[1,1.06,1] } : {}}
                  transition={ isKING ? { duration:1.1, repeat:Infinity } : {}}>
                  {tier.subtitle}
                </motion.span>
              )}
            </motion.div>
          </div>
        </div>

        {/* bottom pulse */}
        <motion.div style={{ position:'absolute', bottom:0, left:0, right:0, height: isKING?2:1,
          background: isKING
            ? `linear-gradient(to right,transparent,${tier.primary},${tier.secondary},${tier.accent}cc,transparent)`
            : `linear-gradient(to right,transparent,${tier.primary}99,transparent)` }}
          animate={{ opacity:[.5,1,.5] }} transition={{ duration: isKING?1.3:2, repeat:Infinity }} />
      </div>

      {/* particles */}
      {tier.hasParticles === 'mega'  && <KingParticles tier={tier} mega />}
      {tier.hasParticles === 'king'  && <KingParticles tier={tier} />}
      {tier.hasParticles === 'elite' && <NormalParticles tier={tier} dense />}
      {tier.hasParticles === 'soft'  && <NormalParticles tier={tier} />}
    </motion.div>
  );
}

/* ── King explosion particles ── */
function KingParticles({ tier, mega = false }) {
  const emojis = mega
    ? ['⚜️','👑','✨','💎','⚡','🌟','💥','🔥','🌠','💫']
    : ['👑','⭐','✨','💫','⚡','🌟','💥','🔥'];
  const dots = tier && tier.id >= 5
    ? ['rgba(128,232,255,1)','rgba(255,128,255,1)','rgba(255,215,0,1)','rgba(255,255,255,1)','rgba(180,250,255,1)']
    : ['rgba(255,200,50,1)','rgba(255,100,255,1)','rgba(200,130,255,1)','rgba(80,220,255,1)','rgba(255,255,150,1)'];
  const emojiCount = mega ? 12 : 8;
  const dotCount   = mega ? 28 : 20;
  const ax = tier ? tier.avatarSize/2-8 : 65;
  const ay = tier ? tier.avatarSize/2-2 : 55;
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:3 }}>
      {/* emoji burst */}
      {[...Array(emojiCount)].map((_,i) => {
        const angle = (i/emojiCount)*360;
        const dist  = (mega?120:100) + (i%3)*40;
        const dx = Math.cos(angle*Math.PI/180)*dist;
        const dy = Math.sin(angle*Math.PI/180)*dist;
        return (
          <motion.div key={`e${i}`}
            style={{ position:'absolute', left:ax, top:ay, fontSize:(mega?22:20)+(i%3)*4, zIndex:4 }}
            initial={{ x:0, y:0, scale:0, opacity:0, rotate:0 }}
            animate={{ x:[0,dx*.4,dx], y:[0,dy*.4-40,dy-60], scale:[0,1.5,0], opacity:[0,1,0], rotate:(i%2===0?1:-1)*180 }}
            transition={{ duration:1.8+(i%4)*.3, delay:.15+(i%4)*.1, repeat:Infinity, repeatDelay:(i%3)*.6, ease:'easeOut' }}>
            {emojis[i%emojis.length]}
          </motion.div>
        );
      })}
      {/* glowing dot burst */}
      {[...Array(dotCount)].map((_,i) => {
        const angle = (i/dotCount)*360, dist = (mega?80:70)+(i%5)*35;
        const dx = Math.cos(angle*Math.PI/180)*dist, dy = Math.sin(angle*Math.PI/180)*dist;
        const color = dots[i%dots.length], size = 3+(i%4)*2;
        return (
          <motion.div key={`d${i}`}
            style={{ position:'absolute', left:ax, top:ay, width:size, height:size, borderRadius:'50%',
              background:color, boxShadow:`0 0 ${size*4}px ${color}` }}
            initial={{ x:0, y:0, scale:0, opacity:0 }}
            animate={{ x:[0,dx*.5,dx], y:[0,dy*.5-25,dy-35], scale:[0,2,0], opacity:[0,1,0] }}
            transition={{ duration:1.6+(i%5)*.22, delay:.12+(i%6)*.09, repeat:Infinity, repeatDelay:(i%4)*.5, ease:'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/* ── Normal entry particles (tier 2-3) ── */
function NormalParticles({ tier, dense = false }) {
  const colors = tier
    ? [tier.primary, tier.secondary, tier.accent]
    : ['rgba(155,81,224,1)','rgba(236,72,153,1)','rgba(200,150,255,1)'];
  const count = dense ? 14 : 6;
  const ax = tier ? tier.avatarSize/2-8 : 50;
  const ay = tier ? tier.avatarSize/2-2 : 40;
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'visible', zIndex:3 }}>
      {[...Array(count)].map((_,i) => {
        const angle = (i/count)*360, dist = (dense?75:55)+(i%3)*25;
        const dx = Math.cos(angle*Math.PI/180)*dist, dy = Math.sin(angle*Math.PI/180)*dist;
        const color = colors[i%colors.length], size = 2+(i%3);
        return (
          <motion.div key={i} style={{ position:'absolute', left:ax, top:ay, width:size, height:size, borderRadius:'50%', background:color, boxShadow:`0 0 ${size*3}px ${color}` }}
            initial={{ x:0, y:0, scale:0, opacity:0 }}
            animate={{ x:[0,dx*.5,dx], y:[0,dy*.5-20,dy-30], scale:[0,1.5,0], opacity:[0,1,0] }}
            transition={{ duration:1.4+(i%4)*.2, delay:.2+(i%5)*.1, repeat:Infinity, repeatDelay:(i%3)*.8, ease:'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/* ── King lightning sparks ── */
function KingLightning() {
  return (
    <div style={{ position:'absolute', top:-6, left:0, right:0, height:12, overflow:'visible', pointerEvents:'none', zIndex:4 }}>
      {[...Array(6)].map((_,i) => (
        <motion.div key={i}
          style={{ position:'absolute', top:0, left:`${10+i*15}%`, fontSize:16,
            animation:`lightningFlash ${0.6+i*.15}s ${i*.12}s infinite`,
            filter:'drop-shadow(0 0 8px rgba(255,220,50,1))' }}>
          ⚡
        </motion.div>
      ))}
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
