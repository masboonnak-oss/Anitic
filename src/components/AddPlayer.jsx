import React, { useState, useRef } from 'react';
import styles from './AddPlayer.module.css';

const uiAvatarUrl = (uname) => {
  const initials = encodeURIComponent((uname || '?').slice(0, 2).toUpperCase());
  return `https://ui-avatars.com/api/?name=${initials}&background=1a1a2e&color=ffd700&bold=true&size=128`;
};

const isRealPic = (url) => url && url.startsWith('/api/avatar/');

export default function AddPlayer({ onAdd }) {
  const [username, setUsername]         = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [manualPicUrl, setManualPicUrl] = useState('');
  const [loading, setLoading]           = useState(false);
  const [picFailed, setPicFailed]       = useState(false);
  const debounceRef = useRef(null);

  function handleUsernameChange(e) {
    const val = e.target.value;
    setUsername(val);
    setDisplayName('');
    setProfilePicUrl('');
    setManualPicUrl('');
    setPicFailed(false);

    const uname = val.trim().replace('@', '');
    if (!uname || uname.length < 2) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tiktok-info/${encodeURIComponent(uname)}`);
        const data = await res.json();
        const pic = data.profilePicUrl || '';
        setProfilePicUrl(pic);
        setPicFailed(!isRealPic(pic));
        if (data.displayName && data.displayName !== uname) {
          setDisplayName(data.displayName);
        }
      } catch (_) {
        setProfilePicUrl('');
        setPicFailed(true);
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
    const finalPic  = manualPicUrl.trim() || profilePicUrl || uiAvatarUrl(uname);
    onAdd({ username: uname, displayName: finalName, profilePicUrl: finalPic });
    setUsername('');
    setDisplayName('');
    setProfilePicUrl('');
    setManualPicUrl('');
    setPicFailed(false);
  }

  const uname  = username.trim().replace('@', '');
  const activePic = manualPicUrl.trim() || profilePicUrl || (uname.length >= 2 ? uiAvatarUrl(uname) : null);

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={submit}>
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

        {uname.length >= 2 && (
          <div className={styles.nameWrap}>
            {activePic && (
              <img
                className={styles.nameAvatar}
                src={activePic}
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

      {uname.length >= 2 && picFailed && !loading && (
        <div className={styles.picUrlRow}>
          <span className={styles.picUrlLabel}>🖼️ วาง URL รูปโปรไฟล์</span>
          <input
            className={styles.picUrlInput}
            placeholder="https://... (ถ้าดึงรูปอัตโนมัติไม่ได้)"
            value={manualPicUrl}
            onChange={e => setManualPicUrl(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}
    </div>
  );
}
