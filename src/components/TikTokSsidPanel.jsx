import React, { useState, useEffect } from 'react';
import { apiFetch } from '../auth.js';
import s from './TikTokSsidPanel.module.css';

export default function TikTokSsidPanel({ notify }) {
  const [ssidInfo,   setSsidInfo]   = useState(null);
  const [manualSsid, setManualSsid] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [showFull,   setShowFull]   = useState(false);

  async function load() {
    try {
      const res  = await apiFetch('/api/admin/tiktok-ssid');
      const data = await res.json();
      if (res.ok) setSsidInfo(data);
    } catch (_) {}
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const val = manualSsid.trim();
    if (!val) return;
    setSaving(true);
    try {
      const res  = await apiFetch('/api/admin/tiktok-ssid', {
        method: 'POST', body: JSON.stringify({ ssid: val }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('✅ บันทึก Session ID แล้ว', 'success');
        setManualSsid('');
        setShowFull(false);
        load();
      } else {
        notify(data.error || 'บันทึกไม่ได้', 'error');
      }
    } catch (_) { notify('เชื่อมต่อไม่ได้', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.wrap}>

      {/* ── Current status ── */}
      <div className={s.statusCard}>
        <div className={s.statusLeft}>
          <div className={s.ttIcon}>
            <svg width="24" height="28" viewBox="0 0 50 56" fill="none">
              <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="#25F4EE" transform="translate(-1.5,1.5)"/>
              <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="#FE2C55" transform="translate(1.5,-1.5)"/>
              <path d="M35.5 0h-8.8v37.7c0 5.1-4.1 9.3-9.2 9.3-5.1 0-9.2-4.2-9.2-9.3s4.1-9.2 9.2-9.2c.9 0 1.8.1 2.6.4V19.5c-.9-.1-1.7-.2-2.6-.2C7.9 19.3 0 27.2 0 37c0 9.8 7.9 17.7 17.5 17.7S35 46.8 35 37V18.6c3.4 2.5 7.6 4 12.1 4h1.4V13.4h-1.4c-6.4 0-11.6-5.3-11.6-13.4z" fill="white"/>
            </svg>
          </div>
          <div>
            <div className={s.statusLabel}>TikTok Session ID (SSID)</div>
            {!ssidInfo ? (
              <div className={s.statusLoading}>กำลังโหลด...</div>
            ) : ssidInfo.hasSsid ? (
              <>
                <div className={s.statusValue}>{ssidInfo.ssid}</div>
                {ssidInfo.updatedAt && (
                  <div className={s.statusAge}>
                    อัปเดต: {new Date(ssidInfo.updatedAt).toLocaleString('th-TH')}
                  </div>
                )}
              </>
            ) : (
              <div className={s.statusEmpty}>ยังไม่ได้ตั้งค่า Session ID</div>
            )}
          </div>
        </div>
        <span className={`${s.badge} ${ssidInfo?.hasSsid ? s.badgeActive : s.badgeNone}`}>
          {ssidInfo?.hasSsid ? '✅ พร้อมใช้' : '⚠️ ยังไม่มี'}
        </span>
      </div>

      {/* ── How to find SSID ── */}
      <div className={s.guideCard}>
        <div className={s.guideTitle}>📖 วิธีหา Session ID</div>
        <ol className={s.guideList}>
          <li>เปิด <strong>tiktok.com</strong> ใน browser แล้ว Login บัญชีของคุณ</li>
          <li>กด <kbd>F12</kbd> เพื่อเปิด DevTools</li>
          <li>ไปที่ <strong>Application</strong> → <strong>Cookies</strong> → <code>https://www.tiktok.com</code></li>
          <li>หา cookie ที่ชื่อ <code>sessionid</code> แล้ว copy ค่าใน <strong>Value</strong></li>
          <li>นำค่านั้นมาวางในช่องด้านล่าง</li>
        </ol>
      </div>

      {/* ── Input form ── */}
      <div className={s.inputCard}>
        <div className={s.inputCardTitle}>
          <span>✏️</span> วาง Session ID ที่นี่
        </div>
        <form onSubmit={save} className={s.form}>
          <textarea
            className={s.textarea}
            placeholder="วาง sessionid ที่ copy มาจาก browser DevTools..."
            value={manualSsid}
            onChange={e => setManualSsid(e.target.value)}
            rows={3}
            spellCheck={false}
          />
          <div className={s.formFooter}>
            <span className={s.charCount}>
              {manualSsid.trim().length > 0 ? `${manualSsid.trim().length} ตัวอักษร` : ''}
            </span>
            <button
              type="submit"
              className={s.saveBtn}
              disabled={saving || manualSsid.trim().length < 10}
            >
              {saving
                ? <><span className={s.spinner} /> กำลังบันทึก...</>
                : '💾 บันทึก Session ID'
              }
            </button>
          </div>
        </form>
      </div>

      {/* ── Info note ── */}
      <div className={s.infoNote}>
        <span className={s.infoIcon}>🔒</span>
        <span>Session ID จะถูกเก็บในเซิร์ฟเวอร์อย่างปลอดภัย และใช้สำหรับเชื่อมต่อ TikTok Live เท่านั้น ไม่มีการส่งข้อมูลออกนอกระบบ</span>
      </div>
    </div>
  );
}
