import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../auth.js';
import s from './StreamDPSPanel.module.css';

export default function StreamDPSPanel() {
  const [input,     setInput]     = useState('');
  const [status,    setStatus]    = useState('idle');
  const [activeUser, setActiveUser] = useState('');
  const [pingOk,    setPingOk]    = useState(true);
  const pingRef  = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    apiFetch('/api/streamdps/status')
      .then(r => r.json())
      .then(d => {
        if (d.status === 'connected' && d.username) {
          setActiveUser(d.username);
          setInput(d.username);
          setStatus('connected');
          startPing(d.username);
        }
      })
      .catch(() => {});
    return () => stopPing();
  }, []);

  function startPing(uname) {
    stopPing();
    pingRef.current = setInterval(async () => {
      try {
        const r = await apiFetch('/api/streamdps/ping', { method: 'POST' });
        setPingOk(r.ok);
        if (!r.ok) setStatus('error');
      } catch {
        setPingOk(false);
        setStatus('error');
      }
    }, 5000);
  }

  function stopPing() {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
  }

  async function handleConnect(e) {
    e.preventDefault();
    const uname = input.trim().replace('@', '');
    if (!uname) return;
    setStatus('connecting');
    try {
      const r = await apiFetch('/api/streamdps/connect', {
        method: 'POST',
        body: JSON.stringify({ username: uname }),
      });
      if (r.ok) {
        setActiveUser(uname);
        setStatus('connected');
        setPingOk(true);
        startPing(uname);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  async function handleDisconnect() {
    stopPing();
    setStatus('disconnected');
    await apiFetch('/api/streamdps/disconnect', { method: 'POST' });
    setActiveUser('');
    setStatus('idle');
  }

  const iframeUrl = `https://streamdps.com/tiktok-widgets/gifts/?username=${encodeURIComponent(activeUser)}`;

  const statusMap = {
    idle:         { label: 'ยังไม่ได้เชื่อมต่อ', cls: s.badgeIdle },
    connecting:   { label: 'กำลังเชื่อมต่อ...', cls: s.badgeConnecting },
    connected:    { label: '● เชื่อมต่อแล้ว',   cls: s.badgeConnected },
    disconnected: { label: 'ตัดการเชื่อมต่อ',   cls: s.badgeIdle },
    error:        { label: '✕ การเชื่อมต่อมีปัญหา', cls: s.badgeError },
  };

  const isConnected  = status === 'connected';
  const isConnecting = status === 'connecting';
  const badge        = statusMap[status] || statusMap.idle;

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.iconWrap}>
            <span className={s.icon}>🎁</span>
            <div className={isConnected ? s.iconPulse : ''} />
          </div>
          <div>
            <div className={s.title}>TikTok Gift Connector</div>
            <div className={s.sub}>ดูของขวัญ TikTok Live แบบ Real-time ผ่าน StreamDPS</div>
          </div>
        </div>
        <span className={`${s.badge} ${badge.cls}`}>{badge.label}</span>
      </div>

      <form className={s.form} onSubmit={handleConnect}>
        <div className={s.inputRow}>
          <span className={s.at}>@</span>
          <input
            className={s.input}
            placeholder="TikTok username ของไลฟ์..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isConnected || isConnecting}
            autoComplete="off"
          />
          {!isConnected ? (
            <button
              className={`${s.btn} ${s.btnConnect}`}
              type="submit"
              disabled={!input.trim() || isConnecting}
            >
              {isConnecting ? (
                <><span className={s.spinner} /> กำลังเชื่อมต่อ</>
              ) : 'เชื่อมต่อ'}
            </button>
          ) : (
            <button className={`${s.btn} ${s.btnDisconnect}`} type="button" onClick={handleDisconnect}>
              ตัดการเชื่อมต่อ
            </button>
          )}
        </div>
      </form>

      {status === 'error' && (
        <div className={s.errorBar}>
          ⚠️ การเชื่อมต่อมีปัญหา — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือลองใหม่
          <button className={s.retryBtn} onClick={() => { setStatus('idle'); setActiveUser(''); }}>ลองใหม่</button>
        </div>
      )}

      {isConnected && activeUser && (
        <div className={s.iframeSection}>
          <div className={s.iframeHeader}>
            <span className={s.iframeLive}>🔴 LIVE @{activeUser}</span>
            <span className={s.iframePowered}>Powered by StreamDPS</span>
          </div>
          <div className={s.iframeWrap}>
            <div className={s.iframeGlow} />
            <iframe
              ref={iframeRef}
              className={s.iframe}
              src={iframeUrl}
              title="StreamDPS Gift Widget"
              frameBorder="0"
              scrolling="no"
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
          <div className={s.iframeNote}>
            💡 widget แสดงของขวัญ TikTok Live แบบ real-time
            {!pingOk && <span className={s.pingWarn}> · ⚠️ เซิร์ฟเวอร์ตอบสนองช้า</span>}
          </div>
        </div>
      )}

      {!isConnected && !isConnecting && (
        <div className={s.placeholder}>
          <div className={s.placeholderIcon}>🎁</div>
          <p>ใส่ TikTok username แล้วกด <strong>เชื่อมต่อ</strong></p>
          <p className={s.placeholderSub}>widget ของขวัญจะปรากฏที่นี่แบบ real-time</p>
        </div>
      )}
    </div>
  );
}
