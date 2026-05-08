import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../auth.js';
import s from './TikTokSsidPanel.module.css';

const STATUS_LABEL = {
  idle:       '',
  starting:   '⏳ กำลังเริ่ม Chromium...',
  navigating: '🌐 กำลังโหลดหน้า TikTok...',
  'waiting-qr': '🔍 กำลังหา QR Code...',
  'scan-qr':  '📱 รอสแกน QR Code ด้วยโทรศัพท์',
  success:    '✅ ดึง Session ID สำเร็จ!',
  timeout:    '⏰ หมดเวลา กรุณาลองใหม่',
  error:      '❌ เกิดข้อผิดพลาด',
  cancelled:  '🚫 ยกเลิกแล้ว',
};

export default function TikTokSsidPanel({ notify }) {
  const [ssidInfo,   setSsidInfo]   = useState(null);   // { hasSsid, ssid, updatedAt }
  const [status,     setStatus]     = useState('idle');  // login session status
  const [qrDataUrl,  setQrDataUrl]  = useState(null);
  const [errMsg,     setErrMsg]     = useState('');
  const [manualSsid, setManualSsid] = useState('');
  const [savingMan,  setSavingMan]  = useState(false);
  const [starting,   setStarting]   = useState(false);
  const pollRef = useRef(null);

  /* ── Load current SSID info ── */
  async function loadSsidInfo() {
    try {
      const res  = await apiFetch('/api/admin/tiktok-ssid');
      const data = await res.json();
      if (res.ok) setSsidInfo(data);
    } catch (_) {}
  }

  useEffect(() => {
    loadSsidInfo();
    return () => stopPoll();
  }, []);

  /* ── Polling ── */
  function startPoll() {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res  = await apiFetch('/api/admin/tiktok-login/status');
        const data = await res.json();
        setStatus(data.status || 'idle');
        if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
        if (data.error)     setErrMsg(data.error);
        if (data.status === 'success') {
          stopPoll();
          loadSsidInfo();
          notify('✅ Session ID อัปเดตแล้ว!', 'success');
        }
        if (['timeout','error','cancelled','idle'].includes(data.status)) {
          stopPoll();
        }
      } catch (_) {}
    }, 1500);
  }

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  /* ── Start QR login ── */
  async function startLogin() {
    setErrMsg(''); setQrDataUrl(null); setStarting(true);
    try {
      const res  = await apiFetch('/api/admin/tiktok-login/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error || 'เริ่มไม่ได้'); return; }
      setStatus('starting');
      startPoll();
    } catch (_) { setErrMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
    finally { setStarting(false); }
  }

  /* ── Cancel ── */
  async function cancelLogin() {
    stopPoll();
    setStatus('idle');
    setQrDataUrl(null);
    try { await apiFetch('/api/admin/tiktok-login/cancel', { method: 'POST' }); } catch (_) {}
  }

  /* ── Manual SSID save ── */
  async function saveManual(e) {
    e.preventDefault();
    if (!manualSsid.trim()) return;
    setSavingMan(true);
    try {
      const res  = await apiFetch('/api/admin/tiktok-ssid', {
        method: 'POST', body: JSON.stringify({ ssid: manualSsid.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('✅ บันทึก SSID แล้ว', 'success');
        setManualSsid('');
        loadSsidInfo();
      } else {
        notify(data.error || 'บันทึกไม่ได้', 'error');
      }
    } catch (_) { notify('เชื่อมต่อไม่ได้', 'error'); }
    finally { setSavingMan(false); }
  }

  const isRunning = ['starting','navigating','waiting-qr','scan-qr'].includes(status);
  const isDone    = ['success','timeout','error','cancelled'].includes(status);

  return (
    <div className={s.wrap}>

      {/* ── Current SSID status card ── */}
      <div className={s.ssidCard}>
        <div className={s.ssidCardLeft}>
          <div className={s.ttLogo}>
            <svg width="22" height="26" viewBox="0 0 50 56" fill="none">
              <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="#25F4EE" transform="translate(-1.5,1.5)"/>
              <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="#FE2C55" transform="translate(1.5,-1.5)"/>
              <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className={s.ssidLabel}>TikTok Session ID</div>
            {ssidInfo ? (
              ssidInfo.hasSsid
                ? <>
                    <div className={s.ssidValue}>{ssidInfo.ssid}</div>
                    {ssidInfo.updatedAt && (
                      <div className={s.ssidAge}>
                        อัปเดตล่าสุด: {new Date(ssidInfo.updatedAt).toLocaleString('th-TH')}
                      </div>
                    )}
                  </>
                : <div className={s.ssidEmpty}>ยังไม่มี Session ID</div>
            ) : (
              <div className={s.ssidLoading}>กำลังโหลด...</div>
            )}
          </div>
        </div>
        <div className={s.ssidBadge} data-has={ssidInfo?.hasSsid ? 'true' : 'false'}>
          {ssidInfo?.hasSsid ? '✅ Active' : '❌ ไม่มี'}
        </div>
      </div>

      {/* ── QR Login section ── */}
      <div className={s.section}>
        <h3 className={s.sectionTitle}>
          <span className={s.sectionIcon}>📷</span>
          Login ด้วย QR Code
        </h3>
        <p className={s.sectionDesc}>
          ระบบจะเปิดหน้า TikTok Login ใน Chromium และแสดง QR Code<br />
          สแกนด้วยโทรศัพท์แล้วระบบจะดึง Session ID อัตโนมัติ
        </p>

        {/* Status bar */}
        {status !== 'idle' && (
          <div className={`${s.statusBar} ${s[`status_${status}`]}`}>
            {isRunning && <span className={s.statusSpinner} />}
            <span>{STATUS_LABEL[status] || status}</span>
            {errMsg && <span className={s.statusErr}> — {errMsg}</span>}
          </div>
        )}

        {/* QR Code display */}
        {qrDataUrl && (
          <div className={s.qrWrap}>
            <div className={s.qrFrame}>
              <img src={qrDataUrl} alt="TikTok QR Code" className={s.qrImg} />
            </div>
            <p className={s.qrHint}>
              เปิดแอป TikTok → โปรไฟล์ → ☰ → สแกน QR Code
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className={s.btnRow}>
          {!isRunning ? (
            <button
              className={s.startBtn}
              onClick={startLogin}
              disabled={starting}
            >
              {starting
                ? <><span className={s.btnSpinner} /> กำลังเริ่ม...</>
                : <><span>🎵</span> Login TikTok เพื่อซิงค์ SSID</>
              }
            </button>
          ) : (
            <button className={s.cancelBtn} onClick={cancelLogin}>
              ✕ ยกเลิก
            </button>
          )}
        </div>
      </div>

      {/* ── Manual SSID section ── */}
      <div className={s.section}>
        <h3 className={s.sectionTitle}>
          <span className={s.sectionIcon}>✏️</span>
          ใส่ Session ID ด้วยตนเอง
        </h3>
        <p className={s.sectionDesc}>
          วาง sessionid ที่ได้จาก TikTok cookies โดยตรง
        </p>
        <form className={s.manualForm} onSubmit={saveManual}>
          <input
            className={s.manualInput}
            type="text"
            placeholder="วาง sessionid ที่นี่..."
            value={manualSsid}
            onChange={e => setManualSsid(e.target.value)}
          />
          <button
            type="submit"
            className={s.saveBtn}
            disabled={savingMan || !manualSsid.trim()}
          >
            {savingMan ? '⏳' : '💾 บันทึก'}
          </button>
        </form>
        <p className={s.manualHint}>
          วิธีหา sessionid: เปิด TikTok ใน browser → F12 → Application → Cookies → <code>sessionid</code>
        </p>
      </div>
    </div>
  );
}
