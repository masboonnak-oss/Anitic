import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import s from './Top1.module.css';

const socket = io('/', { transports: ['websocket', 'polling'] });

function Top1Card({ player }) {
  const [imgErr, setImgErr] = useState(false);
  const [bump, setBump]     = useState(false);
  const prevId  = useRef(null);
  const prevWin = useRef(null);

  useEffect(() => { setImgErr(false); }, [player?.id]);

  useEffect(() => {
    if (!player) return;
    if (player.id !== prevId.current || player.win !== prevWin.current) {
      setBump(false);
      requestAnimationFrame(() => setBump(true));
      prevId.current  = player.id;
      prevWin.current = player.win;
    }
  }, [player?.id, player?.win]);

  if (!player) return null;

  return (
    <div className={`${s.widget} ${bump ? s.update : ''}`}>

      <div className={s.titleWrap}>
        <span className={s.titleLine}>TOP 1 IN MY LIVE</span>
      </div>

      <div className={s.frameWrap}>
        <div className={s.glow} />
        <div className={s.avatarCircle}>
          {!imgErr && player.profilePicUrl ? (
            <img src={player.profilePicUrl} alt={player.displayName}
              className={s.avatarImg} onError={() => setImgErr(true)} />
          ) : (
            <div className={s.avatarFallback}>
              {(player.displayName || player.username || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        <img src="/frame-top1.png" className={s.frameImg} alt="" draggable={false} />
      </div>

      <div className={s.name}>{player.displayName || player.username}</div>

      <div className={s.wins}>
        <span className={s.winsNum}>{player.win}</span>
        <span className={s.winsLabel}>WINS</span>
      </div>

    </div>
  );
}

export default function Top1Page() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    socket.on('players', setPlayers);
    return () => socket.off('players');
  }, []);

  const top = players[0] || null;

  return (
    <div className={s.page}>
      {top && <Top1Card key={top.id} player={top} />}
    </div>
  );
}
