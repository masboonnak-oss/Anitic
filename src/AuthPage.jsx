import React, { useState } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

export default function AuthPage({ onAuth }) {
  const [tab, setTab]           = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);

  function switchTab(t) { setTab(t); setError(''); setUsername(''); setPassword(''); setConfirm(''); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (tab === 'register' && password !== confirm) { setError('รหัสผ่านทั้งสองไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      const res  = await fetch(tab === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setToken(data.token);
      onAuth(data.username, data.role || 'user');
    } catch (_) {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.bg}>
      {/* Ambient blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoGlow} />
          <span className={styles.logoEmoji}>🏆</span>
        </div>
        <h1 className={styles.title}>WIN Leaderboard</h1>
        <p className={styles.tagline}>ระบบจัดอันดับสำหรับ TikTok Live</p>

        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => switchTab('login')}>
            เข้าสู่ระบบ
          </button>
          <button className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`} onClick={() => switchTab('register')}>
            สมัครสมาชิก
          </button>
          <div className={styles.tabSlider} style={{ transform: tab === 'register' ? 'translateX(100%)' : 'translateX(0)' }} />
        </div>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label}>👤 ชื่อผู้ใช้</label>
            <input
              className={styles.input}
              type="text"
              placeholder={tab === 'register' ? 'เลือกชื่อผู้ใช้ของคุณ' : 'ชื่อผู้ใช้'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>🔒 รหัสผ่าน</label>
            <div className={styles.pwWrap}>
              <input
                className={styles.input}
                type={showPw ? 'text' : 'password'}
                placeholder={tab === 'register' ? 'อย่างน้อย 6 ตัวอักษร' : 'รหัสผ่าน'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                required
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {tab === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>🔒 ยืนยันรหัสผ่าน</label>
              <input
                className={styles.input}
                type="password"
                placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? (
              <span className={styles.btnSpinner} />
            ) : (
              tab === 'register' ? '✨ สมัครสมาชิก' : '🚀 เข้าสู่ระบบ'
            )}
          </button>
        </form>

        <p className={styles.footer}>
          {tab === 'login' ? (
            <>ยังไม่มีบัญชี? <button className={styles.linkBtn} onClick={() => switchTab('register')}>สมัครฟรี</button></>
          ) : (
            <>มีบัญชีแล้ว? <button className={styles.linkBtn} onClick={() => switchTab('login')}>เข้าสู่ระบบ</button></>
          )}
        </p>

        {tab === 'register' && (
          <div className={styles.infoBox}>
            🎮 แต่ละบัญชีมีลีดเดอร์บอร์ดแยกอิสระ
          </div>
        )}
      </div>
    </div>
  );
}
