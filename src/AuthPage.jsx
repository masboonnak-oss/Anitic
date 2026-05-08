import React, { useState, useRef, useEffect } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

export default function AuthPage({ onAuth }) {
  const [view, setView]               = useState('main'); // 'main' | 'forgot' | 'forgot-sent' | 'verify-email'
  const [tab, setTab]                 = useState('login');
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showPw, setShowPw]           = useState(false);

  /* ── OTP verify state ── */
  const [verifyEmail,    setVerifyEmail]    = useState('');
  const [verifyUsername, setVerifyUsername] = useState('');
  const [otp,    setOtp]    = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown]   = useState(0);
  const [resending, setResending]   = useState(false);
  const otpRefs = useRef([]);

  /* countdown timer */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function switchTab(t) { setTab(t); setError(''); setUsername(''); setEmail(''); setPassword(''); setConfirm(''); }
  function goForgot()   { setView('forgot'); setError(''); setForgotEmail(''); }
  function goMain()     { setView('main');   setError(''); }

  /* ─── REGISTER / LOGIN submit ─── */
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

      /* Registration with email verification pending */
      if (data.pending) {
        setVerifyEmail(data.email);
        setVerifyUsername(data.username);
        setOtp(['', '', '', '', '', '']);
        setCountdown(60);
        setView('verify-email');
        return;
      }

      /* Direct login or no-email-configured register */
      setToken(data.token);
      onAuth(data.username, data.role || 'user');
    } catch (_) {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  }

  /* ─── OTP input handlers ─── */
  function handleOtpChange(idx, val) {
    const digit = val.replace(/\D/, '').slice(-1);
    const next  = [...otp];
    next[idx]   = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  function handleOtpKeyDown(idx, e) {
    if (e.key === 'Backspace') {
      if (otp[idx]) {
        const next = [...otp]; next[idx] = ''; setOtp(next);
      } else if (idx > 0) {
        otpRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next  = [...otp];
    for (let i = 0; i < 6; i++) next[i] = text[i] || '';
    setOtp(next);
    const focusIdx = Math.min(text.length, 5);
    otpRefs.current[focusIdx]?.focus();
  }

  /* ─── OTP verify submit ─── */
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
    } catch (_) {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  }

  /* ─── Resend OTP ─── */
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
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      otpRefs.current[0]?.focus();
    } catch (_) {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setResending(false);
    }
  }

  /* ─── Forgot password ─── */
  async function submitForgot(e) {
    e.preventDefault();
    setError(''); setLoading(true);
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
            {view === 'forgot' || view === 'forgot-sent' ? '🔑' : view === 'verify-email' ? '📧' : '🏆'}
          </span>
        </div>

        {/* ─── VERIFY EMAIL (OTP) ─── */}
        {view === 'verify-email' && (
          <>
            <h1 className={styles.title}>ยืนยันอีเมล</h1>
            <p className={styles.tagline}>ส่ง OTP ไปที่อีเมลของคุณแล้ว</p>

            <div className={styles.verifyInfoBox}>
              <div className={styles.verifyInfoRow}>
                <span className={styles.verifyInfoIcon}>📨</span>
                <span>ส่งรหัส 6 หลักไปที่</span>
              </div>
              <div className={styles.verifyEmail}>{verifyEmail}</div>
              <div className={styles.verifyHint}>ตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์ Spam)</div>
            </div>

            <form className={styles.form} onSubmit={submitVerify}>
              <div className={styles.otpLabel}>กรอกรหัส OTP 6 หลัก</div>
              <div className={styles.otpRow} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    className={`${styles.otpBox} ${digit ? styles.otpBoxFilled : ''}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <span className={styles.errorIcon}>⚠️</span>{error}
                </div>
              )}

              <button className={styles.submitBtn} type="submit" disabled={loading || otp.join('').length < 6}>
                {loading ? <span className={styles.btnSpinner} /> : '✅ ยืนยันรหัส OTP'}
              </button>

              <div className={styles.resendRow}>
                {countdown > 0 ? (
                  <span className={styles.resendCountdown}>ส่งอีกครั้งได้ใน {countdown} วินาที</span>
                ) : (
                  <button
                    type="button"
                    className={styles.resendBtn}
                    onClick={resendOtp}
                    disabled={resending}
                  >
                    {resending ? '⏳ กำลังส่ง...' : '📤 ส่ง OTP อีกครั้ง'}
                  </button>
                )}
              </div>

              <button type="button" className={styles.backBtn} onClick={goMain}>
                ← กลับหน้าสมัคร
              </button>
            </form>
          </>
        )}

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
                  placeholder={tab === 'register' ? 'เลือกชื่อผู้ใช้ (a-z, 0-9, _)' : 'ชื่อผู้ใช้'}
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
                📧 จะส่งรหัสยืนยัน OTP ไปยังอีเมลของคุณ
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
