import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Overlay from './Overlay.jsx';
import NewKingPage from './NewKingPage.jsx';
import Top1Page from './Top1Page.jsx';
import AuthPage from './AuthPage.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';
import GifterLogPage from './GifterLogPage.jsx';
import GiftConnectorPage from './GiftConnectorPage.jsx';
import { getToken, clearToken } from './auth.js';

const path = window.location.pathname;

if (path === '/overlay') {
  ReactDOM.createRoot(document.getElementById('root')).render(<Overlay />);
} else if (path === '/newking') {
  ReactDOM.createRoot(document.getElementById('root')).render(<NewKingPage />);
} else if (path === '/top1') {
  ReactDOM.createRoot(document.getElementById('root')).render(<Top1Page />);
} else if (path === '/reset-password') {
  ReactDOM.createRoot(document.getElementById('root')).render(<ResetPasswordPage />);
} else if (path === '/gifterlog') {
  ReactDOM.createRoot(document.getElementById('root')).render(<GifterLogPage />);
} else if (path === '/giftconnector') {
  function GiftRoot() {
    const [authed,   setAuthed]   = useState(false);
    const [username, setUsername] = useState('');
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      const token = getToken();
      if (!token) { setChecking(false); return; }
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.ok) { setAuthed(true); setUsername(d.username); }
          else clearToken();
        })
        .catch(() => clearToken())
        .finally(() => setChecking(false));
    }, []);

    if (checking) return (
      <div style={{ minHeight:'100vh', background:'#05030f', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #2a1050', borderTopColor:'#8a2be2', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );

    if (!authed) return (
      <AuthPage onAuth={(u) => { setUsername(u); setAuthed(true); }} />
    );

    return <GiftConnectorPage username={username} />;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<GiftRoot />);
} else {
  function Root() {
    const [authed,   setAuthed]   = useState(false);
    const [username, setUsername] = useState('');
    const [role,     setRole]     = useState('user');
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      const token = getToken();
      if (!token) { setChecking(false); return; }
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.ok) { setAuthed(true); setUsername(d.username); setRole(d.role || 'user'); }
          else clearToken();
        })
        .catch(() => clearToken())
        .finally(() => setChecking(false));
    }, []);

    if (checking) return (
      <div style={{ minHeight:'100vh', background:'#0a0a15', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #222', borderTopColor:'#fe2c55', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );

    if (!authed) return (
      <AuthPage onAuth={(u, r) => { setUsername(u); setRole(r || 'user'); setAuthed(true); }} />
    );

    return (
      <App
        username={username}
        role={role}
        onLogout={() => { clearToken(); setAuthed(false); setUsername(''); setRole('user'); }}
      />
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
}
