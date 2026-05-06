import React, { useState } from 'react';
import styles from './ConnectPanel.module.css';

export default function ConnectPanel({ status, onConnect, onDisconnect }) {
  const [username, setUsername] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const u = username.trim().replace('@', '');
    if (!u) return;
    onConnect(u);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.left}>
        <div className={`${styles.dot} ${status.connected ? styles.online : styles.offline}`} />
        <span className={styles.statusText}>
          {status.connected
            ? `ไลฟ์สด: @${status.username}`
            : 'ยังไม่ได้เชื่อมต่อ'}
        </span>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          placeholder="@TikTokUsername"
          value={username}
          onChange={e => setUsername(e.target.value)}
          disabled={status.connected}
        />
        {status.connected ? (
          <button type="button" className={styles.btnDisconnect} onClick={onDisconnect}>
            ยกเลิก
          </button>
        ) : (
          <button type="submit" className={styles.btnConnect}>
            เชื่อมต่อ
          </button>
        )}
      </form>
    </div>
  );
}
