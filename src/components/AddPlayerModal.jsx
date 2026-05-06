import React, { useState } from 'react';
import styles from './Modal.module.css';

export default function AddPlayerModal({ onSave, onClose }) {
  const [uniqueId, setUniqueId] = useState('');
  const [nickname, setNickname] = useState('');
  const [village, setVillage] = useState('');
  const [winRate, setWinRate] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const id = uniqueId.trim().replace('@', '');
    if (!id) return;
    onSave({ uniqueId: id, nickname: nickname || id, village, winRate });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.avatarPlaceholder}>👤</div>
          <div>
            <div className={styles.title}>เพิ่มผู้เล่น</div>
            <div className={styles.sub}>กรอกข้อมูลผู้เล่นด้วยตนเอง</div>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>TikTok Username <span className={styles.required}>*</span></label>
            <input
              value={uniqueId}
              onChange={e => setUniqueId(e.target.value)}
              placeholder="@username"
              required
            />
          </div>
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
            <button type="submit" className={styles.btnSave}>เพิ่มผู้เล่น</button>
          </div>
        </form>
      </div>
    </div>
  );
}
