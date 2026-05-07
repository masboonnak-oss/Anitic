import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Overlay from './Overlay.jsx';
import NewKingPage from './NewKingPage.jsx';

const path = window.location.pathname;

const page =
  path === '/overlay'  ? <Overlay /> :
  path === '/newking'  ? <NewKingPage /> :
  <App />;

ReactDOM.createRoot(document.getElementById('root')).render(page);
