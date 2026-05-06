import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Overlay from './Overlay.jsx';

const isOverlay = window.location.pathname === '/overlay';

ReactDOM.createRoot(document.getElementById('root')).render(
  isOverlay ? <Overlay /> : <App />
);
