import React, { useState } from 'react';
import styles from './Modal.module.css';

export default function EditPlayerModal({ player, onSave, onClose }) {
  const [village, setVillage] = useState(player.village || '');
  const [winRate, setWinRate] = useState(player.winRate || '');
  const [nickname, setNickname] = useState(player.nickname || player.uniqueId);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(player.uniqueId, { village, winRate, nickname });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.avatar}>
            {player.profilePictureUrl
              ? <img src={player.profilePictureUrl} alt={player.nickname} onError={e => e.target.style.display='none'} />
              : <div className={styles.fallback}>{(player.nickname || player.uniqueId)[0].toUpperCase()}</div>
            }
          </div>
          <div>
            <div className={styles.title}>แก้ไขผู้เล่น</div>
            <div className={styles.sub}>@{player.uniqueId}</div>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>ชื่อที่แสดง</label>
            <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="ชื่อผู้เล่น" />
          </div>
          <div className={styles.field}>
            <label>Village</label>
            <input value={village} onChange={e => setVillage(e.target.value)} placeholder="เช่น Village #1234" />
          </div>
          <div className={styles.field}>
            <label>อัตราการชนะ (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={winRate}
              onChange={e => setWinRate(e.target.value)}
              placeholder="เช่น 75"
            />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>ยกเลิก</button>
            <button type="submit" className={styles.btnSave}>บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  );
}
