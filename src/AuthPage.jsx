import React, { useState, useEffect } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

export default function AuthPage({ onAuth }) {
  const [mode, setMode]         = useState(null); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(d => setMode(d.registered ? 'login' : 'register'))
      .catch(() => setMode('login'));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) {
      setError('รหัสผ่านทั้งสองไม่ตรงกัน');
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setToken(data.token);
      onAuth(data.username);
    } catch (_) {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  }

  if (!mode) {
    return (
      <div className={styles.bg}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const isRegister = mode === 'register';

  return (
    <div className={styles.bg}>
      <div className={styles.card}>
        <div className={styles.logo}>🏆</div>
        <h1 className={styles.title}>WIN Leaderboard</h1>
        <p className={styles.sub}>
          {isRegister ? 'ตั้งค่าบัญชีแอดมินครั้งแรก' : 'ล็อคอินเพื่อเข้าใช้งาน'}
        </p>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label}>ชื่อผู้ใช้</label>
            <input
              className={styles.input}
              type="text"
              placeholder={isRegister ? 'ตั้งชื่อผู้ใช้...' : 'ชื่อผู้ใช้'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>รหัสผ่าน</label>
            <input
              className={styles.input}
              type="password"
              placeholder={isRegister ? 'อย่างน้อย 6 ตัวอักษร' : 'รหัสผ่าน'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </div>

          {isRegister && (
            <div className={styles.field}>
              <label className={styles.label}>ยืนยันรหัสผ่าน</label>
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

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'กำลังโหลด...' : isRegister ? 'สมัครสมาชิก' : 'ล็อคอิน'}
          </button>
        </form>

        {isRegister && (
          <p className={styles.note}>
            บัญชีแอดมินจะถูกสร้างเพียงครั้งเดียว<br />หากลืมรหัสผ่านต้อง reset ไฟล์ cache/_auth.json
          </p>
        )}
      </div>
    </div>
  );
}
