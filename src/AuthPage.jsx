import React, { useState, useRef, useEffect } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

/* ── TikTok Logo SVG ── */
function TikTokIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* cyan shadow */}
      <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="#25F4EE" transform="translate(-2,2)"/>
      {/* red shadow */}
      <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="#FE2C55" transform="translate(2,-2)"/>
      {/* white main */}
      <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="white"/>
    </svg>
  );
}

/* ── Social icons ── */
const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
  </svg>
);
const IconFacebook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);
const IconGoogle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
const IconApple = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);
const IconLine = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#06C755">
    <path d="M19.365 9.89c.50 0 .907.41.907.91s-.407.91-.907.91H17.37v1.485h1.995c.5 0 .907.41.907.91s-.407.91-.907.91H16.46a.908.908 0 01-.908-.91V9.89c0-.5.408-.908.908-.908h2.905zm-5.832 4.13c0 .5-.408.91-.907.91a.908.908 0 01-.906-.91V9.89c0-.5.407-.908.906-.908.5 0 .907.408.907.908v4.13zm-3.08.91a.908.908 0 01-.907-.91V9.89c0-.5.408-.908.908-.908.498 0 .906.408.906.908v2.717L8.954 9.518A.907.907 0 008.1 9c-.5 0-.907.408-.907.908v4.133c0 .5.407.91.907.91.498 0 .906-.41.906-.91v-2.726l2.35 3.107a.907.907 0 00.72.36zM24 10.24C24 4.594 18.627 0 12 0S0 4.594 0 10.24c0 5.061 4.49 9.3 10.56 10.101.41.089.97.271 1.11.622.127.32.084.821.041 1.145l-.18 1.079c-.055.32-.252 1.252 1.096.682 1.347-.568 7.274-4.283 9.92-7.334C23.26 14.613 24 12.52 24 10.24z"/>
  </svg>
);
const IconQR = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm7-2h7v7h-7V3zm2 2v3h3V5h-3zM3 13h7v7H3v-7zm2 2v3h3v-3H5zm12 0h2v2h-2v-2zm0 4h2v2h-2v-2zm-4-4h2v2h-2v-2zm4-4h2v2h-2v-2zm-4 8h2v2h-2v-2zm4 0h2v2h-2v-2zm-8-8h2v2h-2v-2z"/>
  </svg>
);

export default function AuthPage({ onAuth }) {
  const [view, setView]               = useState('tiktok');
  const [tab, setTab]                 = useState('login');
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [socialNote, setSocialNote]   = useState('');

  const [verifyEmail,    setVerifyEmail]    = useState('');
  const [verifyUsername, setVerifyUsername] = useState('');
  const [otp,    setOtp]    = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown]   = useState(0);
  const [resending, setResending]   = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function goLogin()    { setTab('login');    setError(''); setSocialNote(''); setView('form'); }
  function goRegister() { setTab('register'); setError(''); setSocialNote(''); setView('form'); }
  function goForgot()   { setView('forgot'); setError(''); setForgotEmail(''); }
  function goTikTok()   { setView('tiktok'); setError(''); setSocialNote(''); }

  function socialClick(name) {
    setSocialNote(`ระบบนี้ใช้บัญชี WIN Leaderboard เท่านั้น กรุณาใช้ชื่อผู้ใช้และรหัสผ่าน`);
  }

  function switchTab(t) {
    setTab(t); setError('');
    setUsername(''); setEmail(''); setPassword(''); setConfirm('');
  }

  async function submit(e) {
    e.preventDefault(); setError('');
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
      if (data.pending) {
        setVerifyEmail(data.email); setVerifyUsername(data.username);
        setOtp(['', '', '', '', '', '']); setCountdown(60);
        setView('verify-email'); return;
      }
      setToken(data.token);
      onAuth(data.username, data.role || 'user');
    } catch (_) { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setLoading(false); }
  }

  function handleOtpChange(idx, val) {
    const digit = val.replace(/\D/, '').slice(-1);
    const next  = [...otp]; next[idx] = digit; setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }
  function handleOtpKeyDown(idx, e) {
    if (e.key === 'Backspace') {
      if (otp[idx]) { const n = [...otp]; n[idx] = ''; setOtp(n); }
      else if (idx > 0) otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft'  && idx > 0) otpRefs.current[idx - 1]?.focus();
    else if   (e.key === 'ArrowRight' && idx < 5) otpRefs.current[idx + 1]?.focus();
  }
  function handleOtpPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next  = [...otp];
    for (let i = 0; i < 6; i++) next[i] = text[i] || '';
    setOtp(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  }

  async function submitVerify(e) {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('กรุณากรอก OTP ให้ครบ 6 หลัก'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setToken(data.token);
      onAuth(data.username, data.role || 'user');
    } catch (_) { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setLoading(false); }
  }

  async function resendOtp() {
    if (countdown > 0 || resending) return;
    setResending(true); setError('');
    try {
      const res  = await fetch('/api/auth/resend-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'ส่งไม่ได้'); return; }
      setOtp(['', '', '', '', '', '']); setCountdown(60);
      otpRefs.current[0]?.focus();
    } catch (_) { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setResending(false); }
  }

  async function submitForgot(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setView('forgot-sent');
    } catch (_) { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.bg}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      {/* ══════════════════════════════════
          TikTok-style landing
      ══════════════════════════════════ */}
      {view === 'tiktok' && (
        <div className={styles.ttCard}>
          {/* Logo row */}
          <div className={styles.ttLogoRow}>
            <TikTokIcon size={38} />
            <span className={styles.ttLogoText}>TikTok</span>
          </div>

          <h1 className={styles.ttTitle}>เข้าสู่ระบบ TikTok</h1>
          <p className={styles.ttSubtitle}>
            จัดการบัญชีของคุณ ดูการแจ้งเตือน<br />
            และติดตาม <span className={styles.ttHighlight}>WIN Leaderboard</span>
          </p>

          <div className={styles.ttMethods}>
            {/* Primary method */}
            <button className={`${styles.ttMethodBtn} ${styles.ttMethodPrimary}`} onClick={goLogin}>
              <span className={styles.ttMethodIcon}><IconPhone /></span>
              <span className={styles.ttMethodLabel}>ใช้โทรศัพท์ / อีเมล / ชื่อผู้ใช้</span>
              <span className={styles.ttMethodArrow}>›</span>
            </button>

            {/* Social methods */}
            {[
              { icon: <IconFacebook />, label: 'ดำเนินการต่อด้วย Facebook',  color: '#1877F2' },
              { icon: <IconGoogle />,   label: 'ดำเนินการต่อด้วย Google',    color: '#EA4335' },
              { icon: <IconApple />,    label: 'ดำเนินการต่อด้วย Apple',     color: '#fff' },
              { icon: <IconLine />,     label: 'ดำเนินการต่อด้วย LINE',      color: '#06C755' },
            ].map(({ icon, label, color }) => (
              <button
                key={label}
                className={styles.ttMethodBtn}
                onClick={() => socialClick(label)}
              >
                <span className={styles.ttMethodIcon}>{icon}</span>
                <span className={styles.ttMethodLabel}>{label}</span>
                <span className={styles.ttMethodArrow}>›</span>
              </button>
            ))}

            {/* QR option */}
            <button className={styles.ttMethodBtn} onClick={() => socialClick('qr')}>
              <span className={styles.ttMethodIcon}><IconQR /></span>
              <span className={styles.ttMethodLabel}>เข้าสู่ระบบด้วย QR Code</span>
              <span className={styles.ttMethodArrow}>›</span>
            </button>
          </div>

          {/* Social note */}
          {socialNote && (
            <div className={styles.ttSocialNote}>
              <span>ℹ️</span> {socialNote}
              <button className={styles.ttSocialNoteBtn} onClick={goLogin}>เข้าสู่ระบบ →</button>
            </div>
          )}

          {/* Divider */}
          <div className={styles.ttDivider}>
            <span className={styles.ttDividerLine} />
            <span className={styles.ttDividerText}>หรือ</span>
            <span className={styles.ttDividerLine} />
          </div>

          {/* Sign up */}
          <p className={styles.ttSignup}>
            ยังไม่มีบัญชี?{' '}
            <button className={styles.ttSignupLink} onClick={goRegister}>สมัครสมาชิก</button>
          </p>

          {/* Footer */}
          <div className={styles.ttFooter}>
            <p className={styles.ttFooterText}>
              ระบบ <strong>WIN Leaderboard</strong> สำหรับ TikTok Live
            </p>
            <p className={styles.ttFooterSub}>By @Babynoryy 💖</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          Login / Register form
      ══════════════════════════════════ */}
      {view === 'form' && (
        <div className={styles.card}>
          {/* Back to TikTok landing */}
          <button className={styles.ttBackBtn} onClick={goTikTok}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>

          <div className={styles.logoWrap}>
            <div className={styles.logoGlow} />
            <TikTokIcon size={44} />
          </div>

          <h1 className={styles.title}>
            {tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </h1>
          <p className={styles.tagline}>WIN Leaderboard</p>

          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'login'    ? styles.tabActive : ''}`} onClick={() => switchTab('login')}>
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
                className={styles.input} type="text"
                placeholder={tab === 'register' ? 'เลือกชื่อผู้ใช้ (a-z, 0-9, _)' : 'ชื่อผู้ใช้'}
                value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" autoFocus required
              />
            </div>

            {tab === 'register' && (
              <div className={styles.field}>
                <label className={styles.label}>📧 อีเมล</label>
                <input
                  className={styles.input} type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" required
                />
              </div>
            )}

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>🔒 รหัสผ่าน</label>
                {tab === 'login' && (
                  <button type="button" className={styles.forgotLink} onClick={goForgot}>ลืมรหัสผ่าน?</button>
                )}
              </div>
              <div className={styles.pwWrap}>
                <input
                  className={styles.input}
                  type={showPw ? 'text' : 'password'}
                  placeholder={tab === 'register' ? 'อย่างน้อย 6 ตัวอักษร' : 'รหัสผ่าน'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'} required
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
                  className={styles.input} type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password" required
                />
              </div>
            )}

            {error && (
              <div className={styles.errorBox}>
                <span className={styles.errorIcon}>⚠️</span>{error}
              </div>
            )}

            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? <span className={styles.btnSpinner} /> : (tab === 'register' ? '✨ สมัครสมาชิก' : '🚀 เข้าสู่ระบบ')}
            </button>
          </form>

          <p className={styles.footer}>
            {tab === 'login'
              ? <>ยังไม่มีบัญชี? <button className={styles.linkBtn} onClick={() => switchTab('register')}>สมัครฟรี</button></>
              : <>มีบัญชีแล้ว? <button className={styles.linkBtn} onClick={() => switchTab('login')}>เข้าสู่ระบบ</button></>
            }
          </p>
          {tab === 'register' && (
            <div className={styles.infoBox}>📧 จะส่งรหัสยืนยัน OTP ไปยังอีเมลของคุณ</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          OTP verify
      ══════════════════════════════════ */}
      {view === 'verify-email' && (
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <div className={styles.logoGlow} />
            <span className={styles.logoEmoji}>📧</span>
          </div>
          <h1 className={styles.title}>ยืนยันอีเมล</h1>
          <p className={styles.tagline}>ส่ง OTP ไปที่อีเมลของคุณแล้ว</p>
          <div className={styles.verifyInfoBox}>
            <div className={styles.verifyInfoRow}><span className={styles.verifyInfoIcon}>📨</span><span>ส่งรหัส 6 หลักไปที่</span></div>
            <div className={styles.verifyEmail}>{verifyEmail}</div>
            <div className={styles.verifyHint}>ตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์ Spam)</div>
          </div>
          <form className={styles.form} onSubmit={submitVerify}>
            <div className={styles.otpLabel}>กรอกรหัส OTP 6 หลัก</div>
            <div className={styles.otpRow} onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => otpRefs.current[i] = el}
                  className={`${styles.otpBox} ${digit ? styles.otpBoxFilled : ''}`}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {error && <div className={styles.errorBox}><span className={styles.errorIcon}>⚠️</span>{error}</div>}
            <button className={styles.submitBtn} type="submit" disabled={loading || otp.join('').length < 6}>
              {loading ? <span className={styles.btnSpinner} /> : '✅ ยืนยันรหัส OTP'}
            </button>
            <div className={styles.resendRow}>
              {countdown > 0
                ? <span className={styles.resendCountdown}>ส่งอีกครั้งได้ใน {countdown} วินาที</span>
                : <button type="button" className={styles.resendBtn} onClick={resendOtp} disabled={resending}>
                    {resending ? '⏳ กำลังส่ง...' : '📤 ส่ง OTP อีกครั้ง'}
                  </button>
              }
            </div>
            <button type="button" className={styles.backBtn} onClick={goTikTok}>← กลับหน้าหลัก</button>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════
          Forgot password
      ══════════════════════════════════ */}
      {view === 'forgot' && (
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <div className={styles.logoGlow} />
            <span className={styles.logoEmoji}>🔑</span>
          </div>
          <h1 className={styles.title}>ลืมรหัสผ่าน</h1>
          <p className={styles.tagline}>รับลิงก์รีเซ็ตผ่านอีเมล</p>
          <div className={styles.forgotInfo}>
            <span className={styles.forgotInfoIcon}>ℹ️</span>
            กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณ
          </div>
          <form className={styles.form} onSubmit={submitForgot}>
            <div className={styles.field}>
              <label className={styles.label}>📧 อีเมลที่ลงทะเบียน</label>
              <input className={styles.input} type="email" placeholder="your@email.com"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoFocus required />
            </div>
            {error && <div className={styles.errorBox}><span className={styles.errorIcon}>⚠️</span>{error}</div>}
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? <span className={styles.btnSpinner} /> : '📨 ส่งลิงก์รีเซ็ต'}
            </button>
            <button type="button" className={styles.backBtn} onClick={goTikTok}>← กลับหน้าหลัก</button>
          </form>
        </div>
      )}

      {/* ── Forgot sent ── */}
      {view === 'forgot-sent' && (
        <div className={styles.card}>
          <div className={styles.logoWrap}><div className={styles.logoGlow} /><span className={styles.logoEmoji}>📧</span></div>
          <h1 className={styles.title}>เช็คอีเมลของคุณ!</h1>
          <p className={styles.tagline}>ลิงก์รีเซ็ตรหัสผ่านถูกส่งแล้ว</p>
          <div className={styles.sentBox}>
            <div className={styles.sentIcon}>📧</div>
            <p className={styles.sentTitle}>อีเมลถูกส่งไปที่</p>
            <p className={styles.sentEmail}>{forgotEmail}</p>
            <p className={styles.sentDesc}>คลิกลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่<br />ลิงก์จะหมดอายุใน <strong style={{color:'#ffd700'}}>1 ชั่วโมง</strong></p>
            <p className={styles.sentNote}>ไม่เห็นอีเมล? ตรวจสอบในโฟลเดอร์ Spam</p>
          </div>
          <button className={styles.submitBtn} style={{ marginTop: 8 }} onClick={goTikTok}>← กลับหน้าหลัก</button>
        </div>
      )}
    </div>
  );
}
