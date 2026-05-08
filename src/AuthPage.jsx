import React, { useState } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

export default function AuthPage({ onAuth }) {
  const [view, setView]         = useState('main'); // 'main' | 'forgot' | 'forgot-sent'
  const [tab, setTab]           = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [forgotUser, setForgotUser] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);

  function switchTab(t) { setTab(t); setError(''); setUsername(''); setPassword(''); setConfirm(''); }
  function goForgot() { setView('forgot'); setError(''); setForgotUser(''); }
  function goMain()   { setView('main');   setError(''); }

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

  async function submitForgot(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUser.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setView('forgot-sent');
    } catch (_) {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.bg}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoGlow} />
          <span className={styles.logoEmoji}>
            {view === 'forgot' || view === 'forgot-sent' ? '🔑' : '🏆'}
          </span>
        </div>

        {/* ─── FORGOT PASSWORD SENT ─── */}
        {view === 'forgot-sent' && (
          <>
            <h1 className={styles.title}>ส่งคำขอแล้ว!</h1>
            <p className={styles.tagline}>รอ Admin รีเซ็ตรหัสผ่านให้คุณ</p>
            <div className={styles.sentBox}>
              <div className={styles.sentIcon}>✅</div>
              <p className={styles.sentTitle}>คำขอถูกส่งไปหา Admin แล้ว</p>
              <p className={styles.sentDesc}>
                ชื่อผู้ใช้ <strong className={styles.sentUser}>{forgotUser}</strong> ถูกบันทึกไว้<br />
                Admin จะเห็นคำขอและตั้งรหัสผ่านใหม่ให้คุณ<br />
                จากนั้นกลับมาล็อคอินด้วยรหัสใหม่ได้เลย
              </p>
            </div>
            <button className={styles.submitBtn} style={{ marginTop: 8 }} onClick={goMain}>
              ← กลับหน้าล็อคอิน
            </button>
          </>
        )}

        {/* ─── FORGOT PASSWORD FORM ─── */}
        {view === 'forgot' && (
          <>
            <h1 className={styles.title}>ลืมรหัสผ่าน</h1>
            <p className={styles.tagline}>Admin จะรีเซ็ตรหัสผ่านให้คุณ</p>

            <div className={styles.forgotInfo}>
              <span className={styles.forgotInfoIcon}>ℹ️</span>
              กรอกชื่อผู้ใช้ของคุณ แล้ว Admin จะได้รับคำขอเพื่อตั้งรหัสผ่านใหม่
            </div>

            <form className={styles.form} onSubmit={submitForgot}>
              <div className={styles.field}>
                <label className={styles.label}>👤 ชื่อผู้ใช้ของคุณ</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="ชื่อผู้ใช้ที่ลงทะเบียนไว้"
                  value={forgotUser}
                  onChange={e => setForgotUser(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <span className={styles.errorIcon}>⚠️</span>
                  {error}
                </div>
              )}

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? <span className={styles.btnSpinner} /> : '📨 ส่งคำขอรีเซ็ต'}
              </button>

              <button type="button" className={styles.backBtn} onClick={goMain}>
                ← กลับหน้าล็อคอิน
              </button>
            </form>
          </>
        )}

        {/* ─── MAIN (LOGIN / REGISTER) ─── */}
        {view === 'main' && (
          <>
            <h1 className={styles.title}>WIN Leaderboard</h1>
            <p className={styles.tagline}>ระบบจัดอันดับสำหรับ TikTok Live</p>

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
                <div className={styles.labelRow}>
                  <label className={styles.label}>🔒 รหัสผ่าน</label>
                  {tab === 'login' && (
                    <button type="button" className={styles.forgotLink} onClick={goForgot}>
                      ลืมรหัสผ่าน?
                    </button>
                  )}
                </div>
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
          </>
        )}
      </div>
    </div>
  );
}
