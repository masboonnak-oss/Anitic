import React, { useState } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

export default function AuthPage({ onAuth }) {
  const [view, setView]         = useState('main'); // 'main' | 'forgot' | 'forgot-sent'
  const [tab, setTab]           = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPw, setShowPw]     = useState(false);

  function switchTab(t) { setTab(t); setError(''); setUsername(''); setEmail(''); setPassword(''); setConfirm(''); }
  function goForgot()   { setView('forgot'); setError(''); setForgotEmail(''); }
  function goMain()     { setView('main');   setError(''); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (tab === 'register' && password !== confirm) { setError('รหัสผ่านทั้งสองไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      const body = tab === 'register'
        ? { username: username.trim(), email: email.trim(), password }
        : { username: username.trim(), password };
      const res  = await fetch(tab === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
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
        <div className={styles.logoWrap}>
          <div className={styles.logoGlow} />
          <span className={styles.logoEmoji}>
            {view === 'forgot' || view === 'forgot-sent' ? '🔑' : '🏆'}
          </span>
        </div>

        {/* ─── FORGOT SENT ─── */}
        {view === 'forgot-sent' && (
          <>
            <h1 className={styles.title}>เช็คอีเมลของคุณ!</h1>
            <p className={styles.tagline}>ลิงก์รีเซ็ตรหัสผ่านถูกส่งแล้ว</p>
            <div className={styles.sentBox}>
              <div className={styles.sentIcon}>📧</div>
              <p className={styles.sentTitle}>อีเมลถูกส่งไปที่</p>
              <p className={styles.sentEmail}>{forgotEmail}</p>
              <p className={styles.sentDesc}>
                คลิกลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่<br />
                ลิงก์จะหมดอายุใน <strong style={{color:'#ffd700'}}>1 ชั่วโมง</strong>
              </p>
              <p className={styles.sentNote}>ไม่เห็นอีเมล? ตรวจสอบในโฟลเดอร์ Spam</p>
            </div>
            <button className={styles.submitBtn} style={{ marginTop: 8 }} onClick={goMain}>
              ← กลับหน้าล็อคอิน
            </button>
          </>
        )}

        {/* ─── FORGOT FORM ─── */}
        {view === 'forgot' && (
          <>
            <h1 className={styles.title}>ลืมรหัสผ่าน</h1>
            <p className={styles.tagline}>รับลิงก์รีเซ็ตผ่านอีเมล</p>

            <div className={styles.forgotInfo}>
              <span className={styles.forgotInfoIcon}>ℹ️</span>
              กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณ
            </div>

            <form className={styles.form} onSubmit={submitForgot}>
              <div className={styles.field}>
                <label className={styles.label}>📧 อีเมลที่ลงทะเบียน</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  autoFocus required
                />
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <span className={styles.errorIcon}>⚠️</span>{error}
                </div>
              )}

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? <span className={styles.btnSpinner} /> : '📨 ส่งลิงก์รีเซ็ต'}
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
                  autoFocus required
                />
              </div>

              {tab === 'register' && (
                <div className={styles.field}>
                  <label className={styles.label}>📧 อีเมล</label>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              )}

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
                  <span className={styles.errorIcon}>⚠️</span>{error}
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
