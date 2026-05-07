import React, { useState, useRef } from 'react';
import styles from './AddPlayer.module.css';

export default function AddPlayer({ onAdd }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  function handleUsernameChange(e) {
    const val = e.target.value;
    setUsername(val);
    setDisplayName('');
    setProfilePicUrl('');

    const uname = val.trim().replace('@', '');
    if (!uname || uname.length < 2) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tiktok-info/${encodeURIComponent(uname)}`);
        const data = await res.json();
        setProfilePicUrl(data.profilePicUrl || `https://unavatar.io/tiktok/${uname}`);
        // Only pre-fill name if server returned something different from username
        if (data.displayName && data.displayName !== uname) {
          setDisplayName(data.displayName);
        }
      } catch (_) {
        setProfilePicUrl(`https://unavatar.io/tiktok/${uname}`);
      } finally {
        setLoading(false);
      }
    }, 600);
  }

  function submit(e) {
    e.preventDefault();
    const uname = username.trim().replace('@', '');
    if (!uname) return;
    const finalName = displayName.trim() || uname;
    const finalPic = profilePicUrl || `https://unavatar.io/tiktok/${uname}`;
    onAdd({ username: uname, displayName: finalName, profilePicUrl: finalPic });
    setUsername('');
    setDisplayName('');
    setProfilePicUrl('');
  }

  const uname = username.trim().replace('@', '');
  const picSrc = profilePicUrl || (uname.length >= 2 ? `https://unavatar.io/tiktok/${uname}` : null);

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={submit}>
        {/* Username field */}
        <div className={styles.inputWrap}>
          <span className={styles.at}>@</span>
          <input
            className={styles.input}
            placeholder="TikTok username..."
            value={username}
            onChange={handleUsernameChange}
            autoComplete="off"
          />
          {loading && <span className={styles.spinner} />}
        </div>

        {/* Display name field — shows when username is typed */}
        {uname.length >= 2 && (
          <div className={styles.nameWrap}>
            {picSrc && (
              <img
                className={styles.nameAvatar}
                src={picSrc}
                alt=""
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
            <input
              className={`${styles.input} ${styles.nameInput}`}
              placeholder="ชื่อที่แสดง (กรอกเองได้)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <button className={styles.btn} type="submit" disabled={!uname}>
          + เพิ่ม
        </button>
      </form>
    </div>
  );
}
