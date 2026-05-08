import React, { useState, useEffect } from 'react';
import { apiFetch } from '../auth.js';
import s from './WatchedGifterPanel.module.css';

export default function WatchedGifterPanel({ socket }) {
  const [watched,  setWatched]  = useState({});
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [imgErrs,  setImgErrs]  = useState({});

  useEffect(() => {
    apiFetch('/api/watch-gifters').then(r => r.json()).then(setWatched).catch(() => {});
    socket.on('watchedGiftersUpdate', setWatched);
    return () => socket.off('watchedGiftersUpdate');
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const uid = input.trim().replace(/^@/, '');
    if (!uid) return;
    setLoading(true);
    await apiFetch('/api/watch-gifter', { method: 'POST', body: JSON.stringify({ uniqueId: uid }) });
    setInput('');
    setLoading(false);
  }

  async function handleRemove(uid) {
    await apiFetch(`/api/watch-gifter/${encodeURIComponent(uid)}`, { method: 'DELETE' });
  }

  async function handleClearLog(uid) {
    await apiFetch(`/api/watch-gifter/${encodeURIComponent(uid)}/log`, { method: 'DELETE' });
  }

  const list = Object.values(watched).sort((a, b) => b.totalDiamonds - a.totalDiamonds);

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span className={s.icon}>🎁</span>
        <span className={s.title}>ติดตามของขวัญ</span>
        <span className={s.hint}>ดักจับของขวัญจากคนเฉพาะ</span>
      </div>

      <form onSubmit={handleAdd} className={s.form}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="@tiktok_username ที่ต้องการติดตาม"
          className={s.input}
        />
        <button type="submit" disabled={loading || !input.trim()} className={s.addBtn}>
          {loading ? '...' : '+ ติดตาม'}
        </button>
      </form>

      {list.length === 0 ? (
        <div className={s.empty}>ยังไม่มีผู้ใช้ที่ติดตาม — ใส่ TikTok username เพื่อเริ่ม</div>
      ) : (
        <div className={s.list}>
          {list.map(w => {
            const initial = (w.displayName || w.uniqueId || '?')[0].toUpperCase();
            const hasErr  = imgErrs[w.uniqueId];
            return (
              <div key={w.uniqueId} className={s.card}>
                <div className={s.cardHead}>
                  <div className={s.avatar}>
                    {!hasErr && w.profilePicUrl ? (
                      <img src={w.profilePicUrl} alt={w.displayName} className={s.avatarImg}
                        onError={() => setImgErrs(p => ({ ...p, [w.uniqueId]: true }))} />
                    ) : (
                      <span className={s.avatarFallback}>{initial}</span>
                    )}
                  </div>
                  <div className={s.info}>
                    <div className={s.name}>{w.displayName !== w.uniqueId ? w.displayName : w.uniqueId}</div>
                    <a href={w.profileUrl} target="_blank" rel="noopener noreferrer" className={s.link}>
                      @{w.uniqueId}
                    </a>
                  </div>
                  <div className={s.totalBox}>
                    <span className={s.totalDiamonds}>💎 {w.totalDiamonds.toLocaleString()}</span>
                    <span className={s.totalLabel}>diamonds</span>
                  </div>
                  <div className={s.actions}>
                    <button onClick={() => handleClearLog(w.uniqueId)} className={s.clearBtn} title="ล้าง log">🗑</button>
                    <button onClick={() => handleRemove(w.uniqueId)}   className={s.removeBtn} title="ยกเลิกติดตาม">✕</button>
                  </div>
                </div>

                {w.giftLog && w.giftLog.length > 0 ? (
                  <div className={s.giftLog}>
                    <div className={s.logHeader}>ประวัติของขวัญ ({w.giftLog.length} รายการ)</div>
                    {w.giftLog.slice(0, 15).map((g, i) => (
                      <div key={i} className={s.giftRow}>
                        <span className={s.giftName}>{g.name || 'ของขวัญ'}</span>
                        {g.count > 1 && <span className={s.giftCount}>×{g.count}</span>}
                        <span className={s.giftDiamonds}>💎 {g.diamonds.toLocaleString()}</span>
                        <span className={s.giftTime}>
                          {new Date(g.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {w.giftLog.length > 15 && (
                      <div className={s.moreRow}>+ อีก {w.giftLog.length - 15} รายการ</div>
                    )}
                  </div>
                ) : (
                  <div className={s.noGifts}>ยังไม่มีของขวัญ — รอรับระหว่างไลฟ์</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
