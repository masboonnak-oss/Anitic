import React, { useState, useRef } from 'react';
import styles from './AddPlayer.module.css';

export default function AddPlayer({ onAdd }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  function handleChange(e) {
    const val = e.target.value;
    setInput(val);
    setPreview(null);

    const username = val.trim().replace('@', '');
    if (!username || username.length < 2) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tiktok-info/${encodeURIComponent(username)}`);
        const data = await res.json();
        setPreview(data);
      } catch (e) {
        setPreview({ username, displayName: username, profilePicUrl: `https://unavatar.io/tiktok/${username}` });
      } finally {
        setLoading(false);
      }
    }, 700);
  }

  function submit(e) {
    e.preventDefault();
    const username = input.trim().replace('@', '');
    if (!username) return;
    onAdd({
      username,
      displayName: preview?.displayName || username,
      profilePicUrl: preview?.profilePicUrl || `https://unavatar.io/tiktok/${username}`
    });
    setInput('');
    setPreview(null);
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.inputWrap}>
          <span className={styles.at}>@</span>
          <input
            className={styles.input}
            placeholder="TikTok username..."
            value={input}
            onChange={handleChange}
            autoComplete="off"
          />
          {loading && <span className={styles.spinner} />}
        </div>
        <button className={styles.btn} type="submit" disabled={!input.trim()}>
          + เพิ่ม
        </button>
      </form>

      {preview && (
        <div className={styles.preview}>
          <img
            className={styles.previewImg}
            src={preview.profilePicUrl}
            alt={preview.displayName}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div className={styles.previewInfo}>
            <div className={styles.previewName}>{preview.displayName}</div>
            <div className={styles.previewUser}>@{preview.username}</div>
          </div>
          <div className={styles.previewCheck}>✓ พร้อมเพิ่ม</div>
        </div>
      )}
    </div>
  );
}
