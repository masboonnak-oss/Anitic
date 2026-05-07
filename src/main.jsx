import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Overlay from './Overlay.jsx';
import NewKingPage from './NewKingPage.jsx';
import Top1Page from './Top1Page.jsx';

const path = window.location.pathname;

const page =
  path === '/overlay'  ? <Overlay /> :
  path === '/newking'  ? <NewKingPage /> :
  path === '/top1'     ? <Top1Page /> :
  <App />;

ReactDOM.createRoot(document.getElementById('root')).render(page);
