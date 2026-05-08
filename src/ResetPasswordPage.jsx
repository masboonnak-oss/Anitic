import React, { useState, useEffect } from 'react';
import styles from './AuthPage.module.css';

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [status,   setStatus]   = useState('checking'); // 'checking'|'valid'|'invalid'|'done'
  const [username, setUsername] = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setUsername(d.username); setStatus('valid'); }
        else setStatus('invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (newPw !== confirm) { setError('รหัสผ่านทั้งสองไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setStatus('done');
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
            {status === 'done' ? '✅' : status === 'invalid' ? '❌' : '🔑'}
          </span>
        </div>

        {/* Checking */}
        {status === 'checking' && (
          <>
            <h1 className={styles.title}>กำลังตรวจสอบ...</h1>
            <div style={{ display:'flex', justifyContent:'center', padding:'20px 0' }}>
              <div className={styles.btnSpinner} style={{ width:32, height:32, borderWidth:3 }} />
            </div>
          </>
        )}

        {/* Invalid token */}
        {status === 'invalid' && (
          <>
            <h1 className={styles.title}>ลิงก์ไม่ถูกต้อง</h1>
            <p className={styles.tagline}>ลิงก์หมดอายุหรือถูกใช้ไปแล้ว</p>
            <div className={styles.sentBox} style={{ borderColor:'rgba(255,68,68,0.2)', background:'rgba(255,68,68,0.05)' }}>
              <div className={styles.sentIcon}>⏰</div>
              <p className={styles.sentTitle} style={{ color:'#ff6b87' }}>ลิงก์รีเซ็ตหมดอายุแล้ว</p>
              <p className={styles.sentDesc}>ลิงก์มีอายุ 1 ชั่วโมง<br />กรุณาขอลิงก์ใหม่อีกครั้ง</p>
            </div>
            <button className={styles.submitBtn} style={{ marginTop:8 }} onClick={() => window.location.href = '/'}>
              ← กลับหน้าล็อคอิน
            </button>
          </>
        )}

        {/* Valid — show form */}
        {status === 'valid' && (
          <>
            <h1 className={styles.title}>ตั้งรหัสผ่านใหม่</h1>
            <p className={styles.tagline}>บัญชี <strong style={{color:'#fff'}}>{username}</strong></p>

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label}>🔒 รหัสผ่านใหม่</label>
                <div className={styles.pwWrap}>
                  <input
                    className={styles.input}
                    type={showPw ? 'text' : 'password'}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    autoFocus required
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>🔒 ยืนยันรหัสผ่าน</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className={styles.errorBox}>
                  <span className={styles.errorIcon}>⚠️</span>{error}
                </div>
              )}

              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? <span className={styles.btnSpinner} /> : '✓ บันทึกรหัสผ่านใหม่'}
              </button>
            </form>
          </>
        )}

        {/* Done */}
        {status === 'done' && (
          <>
            <h1 className={styles.title}>เปลี่ยนรหัสผ่านแล้ว!</h1>
            <p className={styles.tagline}>บัญชี {username}</p>
            <div className={styles.sentBox}>
              <div className={styles.sentIcon}>🎉</div>
              <p className={styles.sentTitle}>รหัสผ่านถูกเปลี่ยนเรียบร้อย</p>
              <p className={styles.sentDesc}>
                กลับไปล็อคอินด้วยรหัสผ่านใหม่ได้เลย
              </p>
            </div>
            <button className={styles.submitBtn} style={{ marginTop:8 }} onClick={() => window.location.href = '/'}>
              🚀 ไปหน้าล็อคอิน
            </button>
          </>
        )}
      </div>
    </div>
  );
}
