import React, { useState, useRef, useEffect } from 'react';
import { setToken } from './auth.js';
import styles from './AuthPage.module.css';

export default function AuthPage({ onAuth }) {
  const [view, setView]       = useState('main'); // main | forgot | forgot-sent | verify-email
  const [tab, setTab]         = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [showPw, setShowPw]   = useState(false);

  const [verifyEmail,    setVerifyEmail]    = useState('');
  const [otp,    setOtp]    = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function switchTab(t) {
    setTab(t); setError('');
    setUsername(''); setEmail(''); setPassword(''); setConfirm('');
  }
  function goForgot() { setView('forgot'); setError(''); setForgotEmail(''); }
  function goMain()   { setView('main');   setError(''); }

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
        setVerifyEmail(data.email);
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
      {/* Animated background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />
      <div className={styles.gridLines} />

      <div className={styles.wrapper}>
        {/* ── LEFT PANEL ── */}
        <div className={styles.leftPanel}>
          <div className={styles.logoContainer}>
            <div className={styles.logoGlow} />
            <img src="/babynoey-logo.png" alt="BABYNOEY" className={styles.logo} />
          </div>
          <div className={styles.leftText}>
            <h1 className={styles.brandName}>WIN Leaderboard</h1>
            <p className={styles.brandSub}>ระบบจัดอันดับ TikTok Live สุดเอ็กซ์คลูซีฟ</p>
            <div className={styles.features}>
              <div className={styles.featureItem}><span className={styles.featureDot} />Real-time leaderboard</div>
              <div className={styles.featureItem}><span className={styles.featureDot} />Win Rate tracking</div>
              <div className={styles.featureItem}><span className={styles.featureDot} />Admin dashboard</div>
            </div>
          </div>
          <div className={styles.leftFooter}>by @Babynoryy 💜</div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={styles.rightPanel}>
          {/* ════ MAIN LOGIN / REGISTER ════ */}
          {view === 'main' && (
            <div className={styles.formCard}>
              <div className={styles.cardGlow} />

              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  {tab === 'login' ? 'ยินดีต้อนรับกลับมา' : 'สร้างบัญชีใหม่'}
                </h2>
                <p className={styles.cardSub}>
                  {tab === 'login' ? 'เข้าสู่ระบบเพื่อจัดการ Leaderboard' : 'เริ่มต้นใช้งาน WIN Leaderboard'}
                </p>
              </div>

              {/* Tabs */}
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tabBtn} ${tab === 'login' ? styles.tabBtnActive : ''}`}
                  onClick={() => switchTab('login')}
                >เข้าสู่ระบบ</button>
                <button
                  className={`${styles.tabBtn} ${tab === 'register' ? styles.tabBtnActive : ''}`}
                  onClick={() => switchTab('register')}
                >สมัครสมาชิก</button>
                <div
                  className={styles.tabIndicator}
                  style={{ transform: tab === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
                />
              </div>

              <form className={styles.form} onSubmit={submit}>
                {/* Username */}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                    ชื่อผู้ใช้
                  </label>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input} type="text"
                      placeholder={tab === 'register' ? 'เลือกชื่อผู้ใช้ (a-z, 0-9, _)' : 'ชื่อผู้ใช้'}
                      value={username} onChange={e => setUsername(e.target.value)}
                      autoComplete="username" autoFocus required
                    />
                  </div>
                </div>

                {/* Email (register only) */}
                {tab === 'register' && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                      อีเมล
                    </label>
                    <div className={styles.inputWrap}>
                      <input
                        className={styles.input} type="email" placeholder="your@email.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        autoComplete="email" required
                      />
                    </div>
                  </div>
                )}

                {/* Password */}
                <div className={styles.field}>
                  <div className={styles.fieldLabelRow}>
                    <label className={styles.fieldLabel}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.7 1.4-3.1 3.1-3.1 1.7 0 3.1 1.4 3.1 3.1v2z"/></svg>
                      รหัสผ่าน
                    </label>
                    {tab === 'login' && (
                      <button type="button" className={styles.forgotLink} onClick={goForgot}>ลืมรหัสผ่าน?</button>
                    )}
                  </div>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input}
                      type={showPw ? 'text' : 'password'}
                      placeholder={tab === 'register' ? 'อย่างน้อย 6 ตัวอักษร' : 'รหัสผ่าน'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete={tab === 'register' ? 'new-password' : 'current-password'} required
                    />
                    <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                      {showPw
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                {tab === 'register' && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.8-2.2-5-5-5S7 3.2 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.7 1.4-3.1 3.1-3.1 1.7 0 3.1 1.4 3.1 3.1v2z"/></svg>
                      ยืนยันรหัสผ่าน
                    </label>
                    <div className={styles.inputWrap}>
                      <input
                        className={styles.input} type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                        value={confirm} onChange={e => setConfirm(e.target.value)}
                        autoComplete="new-password" required
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className={styles.errorBox}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {error}
                  </div>
                )}

                <button className={styles.submitBtn} type="submit" disabled={loading}>
                  {loading
                    ? <><span className={styles.spinner} /> กำลังดำเนินการ...</>
                    : tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'
                  }
                </button>
              </form>

              <p className={styles.switchRow}>
                {tab === 'login'
                  ? <>ยังไม่มีบัญชี? <button className={styles.switchLink} onClick={() => switchTab('register')}>สมัครฟรีเลย</button></>
                  : <>มีบัญชีแล้ว? <button className={styles.switchLink} onClick={() => switchTab('login')}>เข้าสู่ระบบ</button></>
                }
              </p>
              {tab === 'register' && (
                <div className={styles.otpNote}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                  ระบบจะส่งรหัส OTP ยืนยันทางอีเมล
                </div>
              )}
            </div>
          )}

          {/* ════ OTP VERIFY ════ */}
          {view === 'verify-email' && (
            <div className={styles.formCard}>
              <div className={styles.cardGlow} />
              <div className={styles.verifyIcon}>📧</div>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>ยืนยันอีเมลของคุณ</h2>
                <p className={styles.cardSub}>ส่งรหัส 6 หลักไปที่</p>
                <div className={styles.verifyEmailBadge}>{verifyEmail}</div>
              </div>

              <form className={styles.form} onSubmit={submitVerify}>
                <p className={styles.otpHint}>กรอกรหัส OTP ที่ได้รับ</p>
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

                {error && (
                  <div className={styles.errorBox}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {error}
                  </div>
                )}

                <button className={styles.submitBtn} type="submit" disabled={loading || otp.join('').length < 6}>
                  {loading ? <><span className={styles.spinner} /> กำลังยืนยัน...</> : 'ยืนยัน OTP'}
                </button>

                <div className={styles.resendRow}>
                  {countdown > 0
                    ? <span className={styles.resendCountdown}>ส่งอีกครั้งได้ใน {countdown} วิ</span>
                    : <button type="button" className={styles.resendBtn} onClick={resendOtp} disabled={resending}>
                        {resending ? 'กำลังส่ง...' : 'ส่ง OTP อีกครั้ง'}
                      </button>
                  }
                </div>

                <button type="button" className={styles.backLink} onClick={goMain}>← กลับหน้าเข้าสู่ระบบ</button>
              </form>
            </div>
          )}

          {/* ════ FORGOT PASSWORD ════ */}
          {view === 'forgot' && (
            <div className={styles.formCard}>
              <div className={styles.cardGlow} />
              <div className={styles.verifyIcon}>🔑</div>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>ลืมรหัสผ่าน?</h2>
                <p className={styles.cardSub}>กรอกอีเมลที่ลงทะเบียนไว้ เราจะส่งลิงก์รีเซ็ตให้คุณ</p>
              </div>
              <form className={styles.form} onSubmit={submitForgot}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    อีเมลที่ลงทะเบียน
                  </label>
                  <div className={styles.inputWrap}>
                    <input className={styles.input} type="email" placeholder="your@email.com"
                      value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoFocus required />
                  </div>
                </div>
                {error && (
                  <div className={styles.errorBox}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    {error}
                  </div>
                )}
                <button className={styles.submitBtn} type="submit" disabled={loading}>
                  {loading ? <><span className={styles.spinner} /> กำลังส่ง...</> : 'ส่งลิงก์รีเซ็ต'}
                </button>
                <button type="button" className={styles.backLink} onClick={goMain}>← กลับหน้าเข้าสู่ระบบ</button>
              </form>
            </div>
          )}

          {/* ════ FORGOT SENT ════ */}
          {view === 'forgot-sent' && (
            <div className={styles.formCard}>
              <div className={styles.cardGlow} />
              <div className={styles.sentSuccess}>
                <div className={styles.sentIcon}>✉️</div>
                <h2 className={styles.cardTitle}>เช็คอีเมลของคุณ!</h2>
                <p className={styles.cardSub}>ส่งลิงก์รีเซ็ตรหัสผ่านไปที่</p>
                <div className={styles.verifyEmailBadge}>{forgotEmail}</div>
                <p className={styles.sentNote}>ลิงก์จะหมดอายุใน <strong>1 ชั่วโมง</strong><br />ตรวจสอบโฟลเดอร์ Spam ด้วยนะคะ</p>
              </div>
              <button className={styles.submitBtn} onClick={goMain}>กลับหน้าเข้าสู่ระบบ</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
