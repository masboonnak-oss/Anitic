import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket.js';
import { apiFetch, getToken } from './auth.js';
import s from './GiftConnectorPage.module.css';

const GIFT_LIMIT = 80;
const CHAT_LIMIT = 120;

function Avatar({ src, name, size = 36 }) {
  const [err, setErr] = useState(false);
  const init = (name || '?')[0].toUpperCase();
  return (
    <div className={s.avatar} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {!err && src
        ? <img src={src} alt={name} onError={() => setErr(true)} />
        : <span>{init}</span>
      }
    </div>
  );
}

function GiftItem({ g, idx }) {
  return (
    <div className={s.giftItem} style={{ animationDelay: `${idx * 0.02}s` }}>
      <Avatar src={g.profilePicUrl} name={g.displayName} size={38} />
      <div className={s.giftInfo}>
        <span className={s.giftUser}>{g.displayName}</span>
        <span className={s.giftName}>
          🎁 {g.giftName}
          {g.repeatCount > 1 && <span className={s.giftRepeat}>×{g.repeatCount}</span>}
        </span>
      </div>
      <div className={s.giftDiamonds}>
        <span className={s.diamondIcon}>💎</span>
        <span className={s.diamondNum}>{g.diamonds.toLocaleString()}</span>
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

function StatBox({ icon, value, label }) {
  return (
    <div className={s.statBox}>
      <div className={s.statIcon}>{icon}</div>
      <div className={s.statNum}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

export default function GiftConnectorPage({ username }) {
  const [gifts,   setGifts]   = useState([]);
  const [chats,   setChats]   = useState([]);
  const [stats,   setStats]   = useState({ viewers: 0, likes: 0, diamonds: 0 });
  const [liveStatus, setLiveStatus] = useState('disconnected');
  const [liveHost,   setLiveHost]   = useState('');
  const [liveError,  setLiveError]  = useState('');
  const [connectInput, setConnectInput] = useState('');
  const [sdpsUser, setSdpsUser] = useState('');
  const [chatAutoScroll, setChatAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState('gifts');
  const chatEndRef = useRef(null);
  const giftEndRef = useRef(null);

  useEffect(() => {
    function authenticate() {
      const token = getToken();
      if (token) socket.emit('authenticate', { token });
    }
    authenticate();
    socket.on('connect', authenticate);

    function onLiveStatus(d) {
      setLiveStatus(d.status);
      setLiveHost(d.host || '');
      setLiveError(d.error || '');
    }
    function onGift(g) {
      setGifts(prev => [g, ...prev].slice(0, GIFT_LIMIT));
      setStats(prev => ({ ...prev, diamonds: prev.diamonds + (g.diamonds || 0) }));
    }
    function onChat(c) {
      setChats(prev => [...prev, c].slice(-CHAT_LIMIT));
    }
    function onLike(d) {
      if (typeof d.totalLikeCount === 'number') setStats(prev => ({ ...prev, likes: d.totalLikeCount }));
    }
    function onViewers(d) {
      if (typeof d.viewerCount === 'number') setStats(prev => ({ ...prev, viewers: d.viewerCount }));
    }

    socket.on('liveStatus',    onLiveStatus);
    socket.on('tiktokGift',    onGift);
    socket.on('tiktokChat',    onChat);
    socket.on('tiktokLike',    onLike);
    socket.on('tiktokViewers', onViewers);

    apiFetch('/api/live/status').then(r => r.json()).then(d => {
      setLiveStatus(d.status || 'disconnected');
      setLiveHost(d.host || '');
    }).catch(() => {});

    return () => {
      socket.off('connect', authenticate);
      socket.off('liveStatus',    onLiveStatus);
      socket.off('tiktokGift',    onGift);
      socket.off('tiktokChat',    onChat);
      socket.off('tiktokLike',    onLike);
      socket.off('tiktokViewers', onViewers);
    };
  }, []);

  useEffect(() => {
    if (chatAutoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, chatAutoScroll]);

  const isConnected  = liveStatus === 'connected';
  const isConnecting = liveStatus === 'connecting';
  const isError      = liveStatus === 'error';

  async function handleConnect(e) {
    e.preventDefault();
    const uname = connectInput.trim().replace('@', '');
    if (!uname) return;
    await apiFetch('/api/live/connect', { method: 'POST', body: JSON.stringify({ username: uname }) });
  }

  async function handleDisconnect() {
    await apiFetch('/api/live/disconnect', { method: 'POST' });
    setStats({ viewers: 0, likes: 0, diamonds: 0 });
  }

  function handleClearGifts() { setGifts([]); }
  function handleClearChats() { setChats([]); }

  const totalDiamonds = gifts.reduce((s, g) => s + (g.diamonds || 0), 0);

  return (
    <div className={s.page}>

      {/* ── Ambient background orbs ── */}
      <div className={s.orb1} />
      <div className={s.orb2} />
      <div className={s.orb3} />

      {/* ── Header ── */}
      <header className={s.header}>
        <button className={s.backBtn} onClick={() => window.location.href = '/'}>
          <span className={s.backArrow}>←</span>
          <span>กลับหน้าหลัก</span>
        </button>

        <div className={s.headerCenter}>
          <div className={s.headerIcon}>🎁</div>
          <div>
            <div className={s.headerTitle}>TikTok Gift Connector</div>
            <div className={s.headerSub}>ติดตามของขวัญ TikTok Live แบบ Real-time</div>
          </div>
        </div>

        <div className={s.headerStatus}>
          {isConnected && (
            <>
              <span className={s.livePulse} />
              <span className={s.liveText}>LIVE</span>
              <span className={s.liveHost}>@{liveHost}</span>
            </>
          )}
          {isConnecting && <span className={s.connectingBadge}>⏳ กำลังเชื่อมต่อ...</span>}
          {isError && <span className={s.errorBadge}>✕ เชื่อมต่อไม่ได้</span>}
          {!isConnected && !isConnecting && !isError && (
            <span className={s.offlineBadge}>● ออฟไลน์</span>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className={s.body}>

        {/* ── Sidebar ── */}
        <aside className={s.sidebar}>

          {/* Connect Card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <span className={s.cardIcon}>📡</span>
              <span className={s.cardTitle}>เชื่อมต่อ TikTok Live</span>
            </div>

            {isError && liveError && (
              <div className={s.errorBar}>⚠️ {liveError}</div>
            )}

            <form className={s.connectForm} onSubmit={handleConnect}>
              <div className={s.inputWrap}>
                <span className={s.at}>@</span>
                <input
                  className={s.input}
                  value={connectInput}
                  onChange={e => setConnectInput(e.target.value)}
                  placeholder="username ไลฟ์สด..."
                  disabled={isConnected || isConnecting}
                  autoComplete="off"
                />
              </div>
              {!isConnected ? (
                <button className={`${s.btn} ${s.btnConnect}`} type="submit"
                  disabled={!connectInput.trim() || isConnecting}>
                  {isConnecting
                    ? <><span className={s.spinner}/> กำลังเชื่อมต่อ</>
                    : '⚡ เชื่อมต่อ'}
                </button>
              ) : (
                <button className={`${s.btn} ${s.btnDisconnect}`} type="button" onClick={handleDisconnect}>
                  ✕ ตัดการเชื่อมต่อ
                </button>
              )}
            </form>
          </div>

          {/* Stats Card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <span className={s.cardIcon}>📊</span>
              <span className={s.cardTitle}>สถิติไลฟ์</span>
            </div>
            <div className={s.statsRow}>
              <StatBox icon="👁" value={stats.viewers} label="ผู้ชม" />
              <StatBox icon="❤️" value={stats.likes}   label="ไลค์" />
              <StatBox icon="💎" value={totalDiamonds} label="Diamonds" />
            </div>
            <div className={s.statsExtra}>
              <span className={s.extraItem}>🎁 ของขวัญ <strong>{gifts.length}</strong> รายการ</span>
              <span className={s.extraItem}>💬 Chat <strong>{chats.length}</strong> รายการ</span>
            </div>
          </div>

          {/* StreamDPS Card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <span className={s.cardIcon}>📺</span>
              <span className={s.cardTitle}>StreamDPS Widget</span>
            </div>
            <p className={s.sdpsNote}>
              เปิด gift widget ใน tab ใหม่เพื่อใช้ใน OBS/Browser Source
            </p>
            <div className={s.sdpsRow}>
              <div className={s.inputWrap}>
                <span className={s.at}>@</span>
                <input
                  className={s.input}
                  placeholder="username..."
                  value={sdpsUser}
                  onChange={e => setSdpsUser(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button
                className={`${s.btn} ${s.btnSdps}`}
                disabled={!sdpsUser.trim()}
                onClick={() => window.open(`https://streamdps.com/tiktok-widgets/gifts/?username=${sdpsUser.trim().replace('@','')}`, '_blank')}
              >
                เปิด →
              </button>
            </div>
          </div>

          {/* Overlay URLs Card */}
          <div className={s.card}>
            <div className={s.cardHeader}>
              <span className={s.cardIcon}>🔗</span>
              <span className={s.cardTitle}>OBS Overlay URLs</span>
            </div>
            {[
              { label: '📺 Leaderboard', path: `/overlay?u=${username}` },
              { label: '👑 New King',    path: `/newking?u=${username}` },
              { label: '🥇 Top 1',       path: `/top1?u=${username}` },
            ].map(({ label, path }) => (
              <button key={path} className={s.urlBtn}
                onClick={() => navigator.clipboard.writeText(window.location.origin + path)}>
                {label} <span className={s.urlCopy}>คัดลอก</span>
              </button>
            ))}
          </div>

        </aside>

        {/* ── Main feed ── */}
        <div className={s.feedArea}>

          {/* Tab bar */}
          <div className={s.tabBar}>
            <button className={`${s.tab} ${activeTab === 'gifts' ? s.tabActive : ''}`}
              onClick={() => setActiveTab('gifts')}>
              🎁 ของขวัญ
              {gifts.length > 0 && <span className={s.tabCount}>{gifts.length}</span>}
            </button>
            <button className={`${s.tab} ${activeTab === 'chat' ? s.tabActive : ''}`}
              onClick={() => setActiveTab('chat')}>
              💬 Chat
              {chats.length > 0 && <span className={s.tabCount}>{chats.length}</span>}
            </button>
            <div className={s.tabSpacer} />
            {activeTab === 'gifts' && gifts.length > 0 && (
              <button className={s.clearBtn} onClick={handleClearGifts}>🗑 ล้าง</button>
            )}
            {activeTab === 'chat' && (
              <>
                <button className={`${s.autoScrollBtn} ${chatAutoScroll ? s.autoScrollOn : ''}`}
                  onClick={() => setChatAutoScroll(p => !p)}>
                  {chatAutoScroll ? '⬇ Auto' : '◻ Auto'}
                </button>
                {chats.length > 0 && <button className={s.clearBtn} onClick={handleClearChats}>🗑 ล้าง</button>}
              </>
            )}
          </div>

          {/* Gift feed */}
          {activeTab === 'gifts' && (
            <div className={s.feedScroll}>
              {gifts.length === 0 ? (
                <div className={s.emptyFeed}>
                  <div className={s.emptyIcon}>🎁</div>
                  <p>{isConnected ? 'รอของขวัญจากไลฟ์...' : 'เชื่อมต่อ TikTok Live ก่อนเริ่มรับข้อมูล'}</p>
                </div>
              ) : (
                gifts.map((g, i) => <GiftItem key={`${g.uniqueId}_${g.ts}_${i}`} g={g} idx={i} />)
              )}
              <div ref={giftEndRef} />
            </div>
          )}

          {/* Chat feed */}
          {activeTab === 'chat' && (
            <div className={s.feedScroll}>
              {chats.length === 0 ? (
                <div className={s.emptyFeed}>
                  <div className={s.emptyIcon}>💬</div>
                  <p>{isConnected ? 'รอคอมเมนต์จากไลฟ์...' : 'เชื่อมต่อ TikTok Live ก่อนเริ่มรับข้อมูล'}</p>
                </div>
              ) : (
                chats.map((c, i) => <ChatItem key={`${c.uniqueId}_${c.ts}_${i}`} c={c} />)
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
