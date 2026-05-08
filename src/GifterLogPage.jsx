import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import s from './GifterLog.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });
const ROOM_USER = new URLSearchParams(window.location.search).get('u') || '';
function joinRoom() { if (ROOM_USER) socket.emit('joinRoom', { username: ROOM_USER }); }
socket.on('connect', joinRoom);
joinRoom();

const EXPIRE_MS = 7000;

const PREVIEW_ALERTS = [
  { _id: 1, uniqueId: 'topfan001', displayName: 'DiamondQueen',  profilePicUrl: null, latestGift: { name: 'TikTok Universe', diamonds: 34999, count: 1  } },
  { _id: 2, uniqueId: 'topfan002', displayName: 'RoyalGifter',   profilePicUrl: null, latestGift: { name: 'Lion',            diamonds: 29999, count: 3  } },
  { _id: 3, uniqueId: 'topfan003', displayName: 'SupporterKing', profilePicUrl: null, latestGift: { name: 'Rose',            diamonds: 1,     count: 50 } },
];

function GiftCard({ item, onRemove, isPreview }) {
  const [phase, setPhase] = useState('enter');
  const [imgErr, setImgErr] = useState(false);
  const t1 = useRef(null);
  const t2 = useRef(null);

  useEffect(() => {
    t1.current = setTimeout(() => setPhase('show'), 60);
    if (!isPreview) {
      t2.current = setTimeout(() => {
        setPhase('exit');
        setTimeout(onRemove, 600);
      }, EXPIRE_MS);
    }
    return () => { clearTimeout(t1.current); clearTimeout(t2.current); };
  }, []);

  const initial = (item.displayName || item.uniqueId || '?')[0].toUpperCase();

  return (
    <div className={`${s.card} ${s['card_' + phase]}`}>
      <div className={s.avatar}>
        {!imgErr && item.profilePicUrl ? (
          <img src={item.profilePicUrl} alt={item.displayName} className={s.avatarImg} onError={() => setImgErr(true)} />
        ) : (
          <span className={s.avatarFallback}>{initial}</span>
        )}
      </div>
      <div className={s.body}>
        <div className={s.userName}>{item.displayName || item.uniqueId}</div>
        <div className={s.giftLine}>
          <span className={s.giftIcon}>🎁</span>
          <span className={s.giftName}>{item.latestGift.name || 'ของขวัญ'}</span>
          {item.latestGift.count > 1 && <span className={s.giftCount}>×{item.latestGift.count}</span>}
        </div>
      </div>
      <div className={s.diamonds}>
        <span className={s.diamondIcon}>💎</span>
        <span className={s.diamondNum}>{item.latestGift.diamonds.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function GifterLogPage() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [alerts, setAlerts] = useState(isPreview ? PREVIEW_ALERTS : []);
  const idRef = useRef(3);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    if (isPreview) return;

    socket.on('watchedGiftAlert', (data) => {
      const id = ++idRef.current;
      setAlerts(prev => [{ ...data, _id: id }, ...prev].slice(0, 6));
    });

    return () => socket.off('watchedGiftAlert');
  }, []);

  function remove(id) {
    setAlerts(prev => prev.filter(a => a._id !== id));
  }

  if (alerts.length === 0) return null;

  return (
    <div className={s.stack}>
      {alerts.map(a => (
        <GiftCard key={a._id} item={a} onRemove={() => remove(a._id)} isPreview={isPreview} />
      ))}
    </div>
  );
}
