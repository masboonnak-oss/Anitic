import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../auth.js';
import s from './AdminPanel.module.css';

export default function AdminPanel({ onClose }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);
  const [confirm, setConfirm] = useState(null); // { username }

  const notify = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2800); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) setUsers(data);
      else notify(data.error || 'โหลดไม่ได้', 'error');
    } catch (_) { notify('เชื่อมต่อไม่ได้', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteUser(username) {
    setConfirm(null);
    const res  = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { notify(`ลบ ${username} แล้ว`, 'info'); load(); }
    else notify(data.error || 'ลบไม่ได้', 'error');
  }

  async function toggleRole(username, currentRole) {
    const newRole = currentRole === 'superadmin' ? 'user' : 'superadmin';
    const res  = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
    const data = await res.json();
    if (res.ok) { notify(`${username} เป็น ${newRole === 'superadmin' ? 'Super Admin' : 'ผู้ใช้ทั่วไป'} แล้ว`); load(); }
    else notify(data.error || 'เปลี่ยนสิทธิ์ไม่ได้', 'error');
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

        {/* Stats bar */}
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
            <span className={s.statLabel}>ผู้เล่นทั้งหมด</span>
          </div>
        </div>

        {/* User list */}
        <div className={s.body}>
          {loading ? (
            <div className={s.loadingWrap}><div className={s.spinner} /></div>
          ) : users.length === 0 ? (
            <div className={s.empty}>ไม่มีผู้ใช้</div>
          ) : (
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
                      className={`${s.roleBtn} ${u.role === 'superadmin' ? s.demoteBtn : s.promoteBtn}`}
                      onClick={() => toggleRole(u.username, u.role)}
                      title={u.role === 'superadmin' ? 'ถอด Admin' : 'เลื่อนเป็น Admin'}
                    >
                      {u.role === 'superadmin' ? '↓ ถอด' : '↑ Admin'}
                    </button>
                    <button
                      className={s.deleteBtn}
                      onClick={() => setConfirm({ username: u.username })}
                      title="ลบบัญชี"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && <div className={`${s.toast} ${s[toast.type]}`}>{toast.msg}</div>}
      </div>

      {/* Confirm dialog */}
      {confirm && (
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
