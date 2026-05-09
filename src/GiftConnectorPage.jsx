import React, { useState, useEffect, useRef } from 'react';
import socket from './socket.js';
import { apiFetch, getToken } from './auth.js';
import s from './GiftConnectorPage.module.css';

const ALERT_CFG = {
  gift:   { label: 'GIFT',   color: '#ffd700', bg: 'rgba(255,215,0,0.08)',  border: 'rgba(255,215,0,0.45)',  icon: '🎁' },
  follow: { label: 'FOLLOW', color: '#00d4ff', bg: 'rgba(0,212,255,0.08)',  border: 'rgba(0,212,255,0.45)',  icon: '💜' },
  like:   { label: 'LIKE',   color: '#ff4d6d', bg: 'rgba(255,77,109,0.08)', border: 'rgba(255,77,109,0.45)', icon: '❤️' },
  member: { label: 'JOIN',   color: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.45)', icon: '👋' },
};
const EV_COLOR = { gift: '#ffd700', follow: '#00d4ff', like: '#ff4d6d', member: '#a855f7', chat: '#6b7280', info: '#4b5563' };

function Avatar({ src, name, size = 38 }) {
  const [err, setErr] = useState(false);
  return (
    <div className={s.avatar} style={{ width: size, height: size, fontSize: size * 0.42, flexShrink: 0 }}>
      {!err && src ? <img src={src} alt={name} onError={() => setErr(true)} /> : <span>{(name || '?')[0].toUpperCase()}</span>}
    </div>
  );
}

function GiftItem({ g }) {
  return (
    <div className={s.giftItem}>
      <Avatar src={g.profilePicUrl} name={g.displayName} size={38} />
      <div className={s.giftInfo}>
        <span className={s.giftUser}>{g.displayName}</span>
        <span className={s.giftName}>🎁 {g.giftName}{g.repeatCount > 1 && <span className={s.repeat}>×{g.repeatCount}</span>}</span>
      </div>
      <div className={s.giftVal}>
        <span className={s.dicon}>💎</span>
        <span className={s.dnum}>{(g.diamonds || 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

function ChatItem({ c }) {
  return (
    <div className={s.chatItem}>
      <Avatar src={c.profilePicUrl} name={c.displayName} size={28} />
      <div className={s.chatContent}>
        <span className={s.chatUser}>{c.displayName}</span>
        <span className={s.chatMsg}>{c.comment}</span>
      </div>
    </div>
  );
}

function EventLine({ e }) {
  return (
    <div className={s.eventLine}>
      <span className={s.evTs}>{e.ts}</span>
      <span className={s.evIcon}>{e.icon}</span>
      <span className={s.evText} style={{ color: e.color }}>{e.text}</span>
    </div>
  );
}

function AlertShowcase({ current, visible, queue }) {
  const cfg = current ? ALERT_CFG[current.type] : null;
  return (
    <div className={s.alertZone}>
      {current && cfg ? (
        <div className={`${s.alertCard} ${visible ? s.alertIn : s.alertOut}`}
          style={{ '--ac': cfg.color, '--ab': cfg.bg, '--abr': cfg.border }}>
          <span className={s.alertLabel} style={{ color: cfg.color, borderColor: cfg.border }}>{cfg.label}</span>
          <div className={s.alertBody}>
            {current.profilePicUrl && (
              <img className={s.alertAvatar} src={current.profilePicUrl} alt=""
                onError={e => e.target.style.display = 'none'} />
            )}
            <div className={s.alertContent}>
              <div className={s.alertUser}>{current.displayName}</div>
              {current.type === 'gift' && (
                <>
                  <div className={s.alertGiftName}>{cfg.icon} {current.giftName}{current.repeat > 1 ? ` ×${current.repeat}` : ''}</div>
                  <div className={s.alertDiamonds} style={{ color: cfg.color }}>💎 {(current.diamonds || 0).toLocaleString()}</div>
                </>
              )}
              {current.type !== 'gift' && (
                <div className={s.alertAction} style={{ color: cfg.color }}>
                  {cfg.icon} {current.type === 'follow' ? 'ติดตามแล้ว!' : current.type === 'like' ? `กด ×${current.count || ''} ไลค์!` : 'เข้าร่วมห้องไลฟ์!'}
                </div>
              )}
            </div>
          </div>
          {queue > 0 && <div className={s.queueBadge}>+{queue} ในคิว</div>}
        </div>
      ) : (
        <div className={s.alertPlaceholder}>
          <div className={s.placeholderRing}>🎁</div>
          <div className={s.placeholderText}>รอ Alert...</div>
          {queue > 0 && <div className={s.queueBadge}>{queue} ในคิว</div>}
        </div>
      )}
    </div>
  );
}

export default function GiftConnectorPage({ username }) {
  const [gifts,  setGifts]  = useState([]);
  const [chats,  setChats]  = useState([]);
  const [events, setEvents] = useState([]);
  const [stats,  setStats]  = useState({ viewers: 0, likes: 0, diamonds: 0 });

  const [liveStatus, setLiveStatus] = useState('disconnected');
  const [liveHost,   setLiveHost]   = useState('');
  const [liveError,  setLiveError]  = useState('');
  const [connectInput, setConnectInput] = useState('');

  const [sdpsUser, setSdpsUser]   = useState('');
  const [sdpsLoaded, setSdpsLoaded] = useState(false);

  const [activeTab, setActiveTab]     = useState('gifts');
  const [chatScroll, setChatScroll]   = useState(true);

  /* ── Alert queue ── */
  const [alertQueue,   setAlertQueue]   = useState([]);
  const [curAlert,     setCurAlert]     = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const alertTimer = useRef(null);

  useEffect(() => {
    if (!curAlert && alertQueue.length > 0) {
      const [next, ...rest] = alertQueue;
      setAlertQueue(rest);
      setCurAlert(next);
      setAlertVisible(true);
      alertTimer.current = setTimeout(() => {
        setAlertVisible(false);
        setTimeout(() => setCurAlert(null), 420);
      }, 4200);
    }
    return () => clearTimeout(alertTimer.current);
  }, [curAlert, alertQueue]);

  function pushAlert(a) {
    setAlertQueue(q => [...q, { ...a, _id: Math.random() }].slice(-20));
  }

  function logEv(icon, text, type = 'info') {
    const ts = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents(ev => [...ev, { icon, text, type, color: EV_COLOR[type] || EV_COLOR.info, ts, _id: Math.random() }].slice(-300));
  }

  /* ── Socket ── */
  const chatEndRef  = useRef(null);
  const eventEndRef = useRef(null);

  useEffect(() => {
    function auth() { const t = getToken(); if (t) socket.emit('authenticate', { t }); }
    auth();
    socket.on('connect', auth);

    function onStatus(d) {
      setLiveStatus(d.status); setLiveHost(d.host || ''); setLiveError(d.error || '');
      if (d.status === 'connected')    logEv('📡', `เชื่อมต่อ @${d.host} สำเร็จ`, 'info');
      if (d.status === 'error')        logEv('❌', `${d.error}`, 'info');
      if (d.status === 'disconnected') logEv('🔌', 'ตัดการเชื่อมต่อ', 'info');
    }
    function onGift(g) {
      setGifts(p => [g, ...p].slice(0, 120));
      setStats(p => ({ ...p, diamonds: p.diamonds + (g.diamonds || 0) }));
      logEv('🎁', `${g.displayName} ส่ง ${g.giftName}${g.repeatCount > 1 ? ` ×${g.repeatCount}` : ''} → 💎 ${(g.diamonds || 0).toLocaleString()}`, 'gift');
      pushAlert({ type: 'gift', displayName: g.displayName, profilePicUrl: g.profilePicUrl, giftName: g.giftName, diamonds: g.diamonds, repeat: g.repeatCount });
    }
    function onChat(c) {
      setChats(p => [...p, c].slice(-150));
      logEv('💬', `${c.displayName}: ${c.comment}`, 'chat');
    }
    function onLike(d) {
      if (typeof d.totalLikeCount === 'number') setStats(p => ({ ...p, likes: d.totalLikeCount }));
    }
    function onViewers(d) {
      if (typeof d.viewerCount === 'number') setStats(p => ({ ...p, viewers: d.viewerCount }));
    }
    function onMember(d) {
      const name = d.displayName || d.uniqueId || 'ผู้ใช้';
      logEv('👋', `${name} เข้าร่วม`, 'member');
      pushAlert({ type: 'member', displayName: name, profilePicUrl: d.profilePicUrl });
    }

    socket.on('liveStatus',    onStatus);
    socket.on('tiktokGift',    onGift);
    socket.on('tiktokChat',    onChat);
    socket.on('tiktokLike',    onLike);
    socket.on('tiktokViewers', onViewers);
    socket.on('tiktokMember',  onMember);

    apiFetch('/api/live/status').then(r => r.json()).then(d => {
      setLiveStatus(d.status || 'disconnected'); setLiveHost(d.host || '');
    }).catch(() => {});

    return () => {
      socket.off('connect', auth);
      socket.off('liveStatus',    onStatus);
      socket.off('tiktokGift',    onGift);
      socket.off('tiktokChat',    onChat);
      socket.off('tiktokLike',    onLike);
      socket.off('tiktokViewers', onViewers);
      socket.off('tiktokMember',  onMember);
    };
  }, []);

  useEffect(() => { if (chatScroll && chatEndRef.current)  chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chats, chatScroll]);
  useEffect(() => { if (eventEndRef.current) eventEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [events]);

  const isConnected  = liveStatus === 'connected';
  const isConnecting = liveStatus === 'connecting';
  const isError      = liveStatus === 'error';
  const totalDiamonds = gifts.reduce((a, g) => a + (g.diamonds || 0), 0);

  async function handleConnect(e) {
    e.preventDefault();
    const uname = connectInput.trim().replace('@', '');
    if (!uname) return;
    logEv('📡', `กำลังเชื่อมต่อ @${uname}...`, 'info');
    await apiFetch('/api/live/connect', { method: 'POST', body: JSON.stringify({ username: uname }) });
  }

  async function handleDisconnect() {
    await apiFetch('/api/live/disconnect', { method: 'POST' });
    setStats({ viewers: 0, likes: 0, diamonds: 0 });
  }

  /* ════════════════════════════════
     HERO (disconnected / connecting)
  ════════════════════════════════ */
  if (!isConnected) {
    return (
      <div className={s.page}>
        <div className={s.orb1} /><div className={s.orb2} />
        <header className={s.header}>
          <button className={s.backBtn} onClick={() => window.location.href = '/'}>← กลับหน้าหลัก</button>
          <div className={s.headerCenter}>
            <div className={s.headerIcon}>🎁</div>
            <div>
              <div className={s.headerTitle}>TikTok Gift Connector</div>
              <div className={s.headerSub}>ติดตามของขวัญ &amp; อีเวนต์ TikTok Live แบบ Real-time</div>
            </div>
          </div>
          <div className={s.offlinePill}>● ออฟไลน์</div>
        </header>

        <div className={s.heroWrap}>
          <div className={s.heroCard}>
            {isConnecting ? (
              <>
                <div className={s.heroSpinner} />
                <h2 className={s.heroTitle}>กำลังเชื่อมต่อ...</h2>
                <p className={s.heroSub}>เชื่อมต่อไปยัง TikTok Live</p>
                <button className={s.heroCancelBtn} onClick={handleDisconnect}>ยกเลิก</button>
              </>
            ) : (
              <>
                <div className={s.heroIcon}>🎁</div>
                <h1 className={s.heroTitle}>เชื่อมต่อ TikTok Live</h1>
                <p className={s.heroSub}>รับข้อมูลของขวัญ แชท ไลค์ แบบ Real-time พร้อม Alert System</p>
                {isError && liveError && <div className={s.heroError}>⚠️ {liveError}</div>}
                <form onSubmit={handleConnect} className={s.heroForm}>
                  <div className={s.heroInputWrap}>
                    <span className={s.heroAt}>@</span>
                    <input
                      className={s.heroInput}
                      value={connectInput}
                      onChange={e => setConnectInput(e.target.value)}
                      placeholder="username คนที่ไลฟ์สด..."
                      autoComplete="off" autoFocus
                    />
                  </div>
                  <button className={s.heroBtn} type="submit" disabled={!connectInput.trim()}>
                    ⚡ CONNECT STREAM
                  </button>
                </form>
                <p className={s.heroNote}>
                  💡 หากเจอ IP_BLOCKED ให้ตั้งค่า <strong>EULER_API_KEY</strong> ใน Environment Secrets
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════
     DASHBOARD (connected)
  ════════════════════════════════ */
  return (
    <div className={s.page}>
      <div className={s.orb1} /><div className={s.orb2} /><div className={s.orb3} />

      {/* ── Header ── */}
      <header className={s.header}>
        <button className={s.backBtn} onClick={() => window.location.href = '/'}>← กลับหน้าหลัก</button>
        <div className={s.headerCenter}>
          <div className={s.headerIcon}>🎁</div>
          <div>
            <div className={s.headerTitle}>TikTok Gift Connector</div>
            <div className={s.headerSub}>ติดตามของขวัญ &amp; อีเวนต์ TikTok Live แบบ Real-time</div>
          </div>
        </div>
        <div className={s.liveChip}>
          <span className={s.liveDot} />
          <span className={s.liveLabel}>LIVE</span>
          <span className={s.liveHost}>@{liveHost}</span>
          <button className={s.disconnectBtn} onClick={handleDisconnect}>ตัดการเชื่อมต่อ</button>
        </div>
      </header>

      {/* ── Stats bar ── */}
      <div className={s.statsBar}>
        {[
          { icon: '👁',  val: stats.viewers,       label: 'ผู้ชม' },
          { icon: '❤️',  val: stats.likes,          label: 'ไลค์' },
          { icon: '💎',  val: totalDiamonds,        label: 'Diamonds' },
          { icon: '🎁',  val: gifts.length,         label: 'ของขวัญ' },
          { icon: '💬',  val: chats.length,         label: 'Chat' },
        ].map((stat, i, arr) => (
          <React.Fragment key={stat.label}>
            <div className={s.statChip}>
              <span className={s.scIcon}>{stat.icon}</span>
              <span className={s.scVal}>{stat.val.toLocaleString()}</span>
              <span className={s.scLabel}>{stat.label}</span>
            </div>
            {i < arr.length - 1 && <div className={s.scDiv} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Body ── */}
      <div className={s.body}>

        {/* ── Sidebar ── */}
        <aside className={s.sidebar}>

          {/* StreamDPS widget */}
          <div className={s.sideCard}>
            <div className={s.sideHead}><span>📺</span><span className={s.sideCTitle}>StreamDPS Widget</span></div>
            {!sdpsLoaded ? (
              <>
                <div className={s.inputWrap}>
                  <span className={s.at}>@</span>
                  <input className={s.input} placeholder="username..." value={sdpsUser}
                    onChange={e => setSdpsUser(e.target.value)} autoComplete="off" />
                </div>
                <div className={s.sdpsBtns}>
                  <button className={`${s.btn} ${s.btnPurple}`} disabled={!sdpsUser.trim()}
                    onClick={() => setSdpsLoaded(true)}>
                    โหลด Widget
                  </button>
                  <button className={`${s.btn} ${s.btnGhost}`} disabled={!sdpsUser.trim()}
                    onClick={() => window.open(`https://streamdps.com/tiktok-widgets/gifts/?username=${sdpsUser.trim().replace('@','')}`, '_blank')}>
                    เปิด Tab →
                  </button>
                </div>
                <p className={s.sdpsNote}>Widget จะแสดงผ่าน proxy ของเซิร์ฟเวอร์</p>
              </>
            ) : (
              <>
                <div className={s.sdpsActive}>
                  <span className={s.sdpsDot} />
                  <span>@{sdpsUser.replace('@','')}</span>
                  <button className={s.sdpsReset} onClick={() => setSdpsLoaded(false)}>✕</button>
                </div>
                <div className={s.sdpsFrame}>
                  <iframe
                    src={`/api/proxy/streamdps?username=${encodeURIComponent(sdpsUser.trim().replace('@',''))}`}
                    title="StreamDPS" className={s.sdpsIframe}
                    allow="autoplay; scripts"
                  />
                </div>
              </>
            )}
          </div>

          {/* OBS URLs */}
          <div className={s.sideCard}>
            <div className={s.sideHead}><span>🔗</span><span className={s.sideCTitle}>OBS Overlay URLs</span></div>
            {[
              { label: '📺 Leaderboard', path: `/overlay?u=${username}` },
              { label: '👑 New King',    path: `/newking?u=${username}` },
              { label: '🥇 Top 1',       path: `/top1?u=${username}` },
              { label: '🎁 Gift Log',    path: `/gifterlog?u=${username}` },
            ].map(({ label, path }) => (
              <button key={path} className={s.urlBtn}
                onClick={() => navigator.clipboard.writeText(window.location.origin + path)}>
                {label} <span className={s.urlCopy}>📋 คัดลอก</span>
              </button>
            ))}
          </div>

        </aside>

        {/* ── Main ── */}
        <div className={s.mainArea}>

          {/* Alert showcase */}
          <AlertShowcase current={curAlert} visible={alertVisible} queue={alertQueue.length} />

          {/* Tab bar */}
          <div className={s.tabBar}>
            {[
              { id: 'gifts',  label: '🎁 ของขวัญ', count: gifts.length },
              { id: 'chat',   label: '💬 Chat',     count: chats.length },
              { id: 'events', label: '📋 Event Log', count: events.length },
            ].map(t => (
              <button key={t.id} className={`${s.tab} ${activeTab === t.id ? s.tabActive : ''}`}
                onClick={() => setActiveTab(t.id)}>
                {t.label}
                {t.count > 0 && <span className={s.tabBadge}>{t.count}</span>}
              </button>
            ))}
            <div className={s.tabSpacer} />
            {activeTab === 'chat' && (
              <button className={`${s.autoBtn} ${chatScroll ? s.autoBtnOn : ''}`}
                onClick={() => setChatScroll(p => !p)}>
                {chatScroll ? '⬇ Auto' : '◻ Manual'}
              </button>
            )}
            {activeTab === 'gifts'  && gifts.length  > 0 && <button className={s.clearBtn} onClick={() => setGifts([])}>🗑 ล้าง</button>}
            {activeTab === 'chat'   && chats.length  > 0 && <button className={s.clearBtn} onClick={() => setChats([])}>🗑 ล้าง</button>}
            {activeTab === 'events' && events.length > 0 && <button className={s.clearBtn} onClick={() => setEvents([])}>🗑 ล้าง</button>}
          </div>

          {/* Feed */}
          <div className={s.feedScroll}>
            {activeTab === 'gifts' && (
              gifts.length === 0
                ? <Empty icon="🎁" text="รอของขวัญจากไลฟ์..." />
                : gifts.map((g, i) => <GiftItem key={`g_${g.ts}_${i}`} g={g} />)
            )}
            {activeTab === 'chat' && (
              <>
                {chats.length === 0
                  ? <Empty icon="💬" text="รอคอมเมนต์จากไลฟ์..." />
                  : chats.map((c, i) => <ChatItem key={`c_${c.ts}_${i}`} c={c} />)
                }
                <div ref={chatEndRef} />
              </>
            )}
            {activeTab === 'events' && (
              events.length === 0
                ? <Empty icon="📋" text="ยังไม่มี Event" />
                : (
                  <div className={s.eventLog}>
                    {events.map(e => <EventLine key={e._id} e={e} />)}
                    <div ref={eventEndRef} />
                  </div>
                )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>{icon}</div>
      <p>{text}</p>
    </div>
  );
}
