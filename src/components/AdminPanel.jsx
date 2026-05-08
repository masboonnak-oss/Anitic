import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../auth.js';
import s from './AdminPanel.module.css';
export default function AdminPanel({ onClose }) {
  const [users,   setUsers]   = useState([]);
  const [reqs,    setReqs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);
  const [confirm, setConfirm] = useState(null);     // { type: 'delete', username }
  const [resetModal, setResetModal] = useState(null); // { username }
  const [newPw,   setNewPw]   = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'requests'

  const notify = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2800); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/reset-requests'),
      ]);
      const [uData, rData] = await Promise.all([uRes.json(), rRes.json()]);
      if (uRes.ok) setUsers(uData);
      if (rRes.ok) setReqs(rData);
    } catch (_) { notify('โหลดไม่ได้', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─── Delete user ─── */
  async function deleteUser(username) {
    setConfirm(null);
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    const d   = await res.json();
    if (res.ok) { notify(`ลบ ${username} แล้ว`, 'info'); load(); }
    else notify(d.error || 'ลบไม่ได้', 'error');
  }

  /* ─── Toggle role ─── */
  async function toggleRole(username, currentRole) {
    const newRole = currentRole === 'superadmin' ? 'user' : 'superadmin';
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
    const d   = await res.json();
    if (res.ok) { notify(`${username} → ${newRole === 'superadmin' ? 'Super Admin' : 'ผู้ใช้ทั่วไป'}`); load(); }
    else notify(d.error || 'เปลี่ยนสิทธิ์ไม่ได้', 'error');
  }

  /* ─── Reset password ─── */
  async function doResetPassword() {
    setPwError('');
    if (newPw.length < 6) { setPwError('ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setPwLoading(true);
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(resetModal.username)}/reset-password`, {
        method: 'POST', body: JSON.stringify({ newPassword: newPw }),
      });
      const d = await res.json();
      if (res.ok) { notify(`รีเซ็ตรหัส ${resetModal.username} แล้ว ✓`); setResetModal(null); setNewPw(''); load(); }
      else setPwError(d.error || 'รีเซ็ตไม่ได้');
    } catch (_) { setPwError('เชื่อมต่อไม่ได้'); }
    finally { setPwLoading(false); }
  }

  /* ─── Dismiss request ─── */
  async function dismissRequest(username) {
    const res = await apiFetch(`/api/admin/reset-requests/${encodeURIComponent(username)}`, { method: 'DELETE' });
    if (res.ok) { notify(`ยกเลิกคำขอของ ${username}`, 'info'); load(); }
  }

  /* ─── Open reset modal from request ─── */
  function openResetFromRequest(username) {
    setResetModal({ username });
    setNewPw(''); setPwError('');
  }

  function timeAgo(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60)   return `${d} วินาทีที่แล้ว`;
    if (d < 3600) return `${Math.floor(d/60)} นาทีที่แล้ว`;
    if (d < 86400) return `${Math.floor(d/3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(d/86400)} วันที่แล้ว`;
  }

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.panel}>
        {/* Header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <span className={s.crown}>👑</span>
            <div>
              <h2 className={s.title}>Super Admin Panel</h2>
              <p className={s.sub}>จัดการผู้ใช้ทั้งหมดในระบบ</p>
            </div>
          </div>
          <button className={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Stats */}
        <div className={s.statsBar}>
          <div className={s.stat}>
            <span className={s.statVal}>{users.length}</span>
            <span className={s.statLabel}>ผู้ใช้ทั้งหมด</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statVal}>{users.filter(u => u.role === 'superadmin').length}</span>
            <span className={s.statLabel}>Super Admin</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statVal}>{users.reduce((a, u) => a + (u.playerCount || 0), 0)}</span>
            <span className={s.statLabel}>ผู้เล่นรวม</span>
          </div>
          <div className={s.statDivider} />
          <div className={s.stat}>
            <span className={s.statVal} style={{ color: reqs.length > 0 ? '#fe2c55' : '#ffd700' }}>
              {reqs.length}
            </span>
            <span className={s.statLabel}>คำขอรีเซ็ต</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className={s.tabBar}>
          <button
            className={`${s.tabBtn} ${activeTab === 'users' ? s.tabBtnActive : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 ผู้ใช้ ({users.length})
          </button>
          <button
            className={`${s.tabBtn} ${activeTab === 'requests' ? s.tabBtnActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            🔑 คำขอรีเซ็ต
            {reqs.length > 0 && <span className={s.badge}>{reqs.length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className={s.body}>
          {loading ? (
            <div className={s.loadingWrap}><div className={s.spinner} /></div>
          ) : activeTab === 'users' ? (
            /* ─── User list ─── */
            users.length === 0 ? <div className={s.empty}>ไม่มีผู้ใช้</div> : (
              <div className={s.userList}>
                {users.map(u => (
                  <div key={u.username} className={`${s.userRow} ${u.role === 'superadmin' ? s.superRow : ''}`}>
                    <div className={s.userAvatar}>
                      {u.username.slice(0, 2).toUpperCase()}
                      {u.role === 'superadmin' && <span className={s.crownBadge}>👑</span>}
                    </div>
                    <div className={s.userInfo}>
                      <span className={s.userName}>{u.username}</span>
                      <span className={`${s.roleBadge} ${u.role === 'superadmin' ? s.badgeSA : s.badgeUser}`}>
                        {u.role === 'superadmin' ? 'Super Admin' : 'ผู้ใช้'}
                      </span>
                    </div>
                    <div className={s.playerCount}>
                      <span className={s.pcNum}>{u.playerCount}</span>
                      <span className={s.pcLabel}>ผู้เล่น</span>
                    </div>
                    <div className={s.actions}>
                      <button
                        className={s.pwBtn}
                        onClick={() => { setResetModal({ username: u.username }); setNewPw(''); setPwError(''); }}
                        title="รีเซ็ตรหัสผ่าน"
                      >🔑</button>
                      <button
                        className={`${s.roleBtn} ${u.role === 'superadmin' ? s.demoteBtn : s.promoteBtn}`}
                        onClick={() => toggleRole(u.username, u.role)}
                      >
                        {u.role === 'superadmin' ? '↓ ถอด' : '↑ Admin'}
                      </button>
                      <button className={s.deleteBtn} onClick={() => setConfirm({ type: 'delete', username: u.username })}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ─── Reset requests ─── */
            reqs.length === 0 ? (
              <div className={s.noRequests}>
                <div className={s.noReqIcon}>✅</div>
                <p>ไม่มีคำขอรีเซ็ตรหัสผ่าน</p>
              </div>
            ) : (
              <div className={s.reqList}>
                {reqs.map(r => (
                  <div key={r.username} className={s.reqRow}>
                    <div className={s.reqAvatar}>{r.username.slice(0, 2).toUpperCase()}</div>
                    <div className={s.reqInfo}>
                      <span className={s.reqUser}>{r.username}</span>
                      <span className={s.reqTime}>🕐 {timeAgo(r.requestedAt)}</span>
                    </div>
                    <div className={s.reqActions}>
                      <button className={s.reqResetBtn} onClick={() => openResetFromRequest(r.username)}>
                        🔑 ตั้งรหัสใหม่
                      </button>
                      <button className={s.reqDismissBtn} onClick={() => dismissRequest(r.username)}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {toast && <div className={`${s.toast} ${s[toast.type]}`}>{toast.msg}</div>}
      </div>

      {/* ─── Reset password modal ─── */}
      {resetModal && (
        <div className={s.confirmOverlay}>
          <div className={s.confirmBox}>
            <div className={s.confirmIcon}>🔑</div>
            <h3 className={s.confirmTitle}>ตั้งรหัสผ่านใหม่</h3>
            <p className={s.confirmText}>
              ผู้ใช้ <strong>{resetModal.username}</strong>
            </p>
            <input
              className={s.pwInput}
              type="password"
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && doResetPassword()}
            />
            {pwError && <p className={s.pwError}>⚠️ {pwError}</p>}
            <div className={s.confirmBtns}>
              <button className={s.cancelBtn} onClick={() => { setResetModal(null); setNewPw(''); setPwError(''); }}>
                ยกเลิก
              </button>
              <button className={s.confirmResetBtn} onClick={doResetPassword} disabled={pwLoading}>
                {pwLoading ? '⏳' : '✓ บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirm ─── */}
      {confirm?.type === 'delete' && (
        <div className={s.confirmOverlay}>
          <div className={s.confirmBox}>
            <div className={s.confirmIcon}>⚠️</div>
            <h3 className={s.confirmTitle}>ลบบัญชี?</h3>
            <p className={s.confirmText}>
              ลบ <strong>{confirm.username}</strong> และข้อมูลผู้เล่นทั้งหมดจะหายถาวร
            </p>
            <div className={s.confirmBtns}>
              <button className={s.cancelBtn} onClick={() => setConfirm(null)}>ยกเลิก</button>
              <button className={s.confirmDeleteBtn} onClick={() => deleteUser(confirm.username)}>ลบถาวร</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
