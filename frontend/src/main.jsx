import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css'; // <-- This line is CRUCIAL
import './index.css'
import { registerSW } from 'virtual:pwa-register';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const updateSW = registerSW({
  onNeedRefresh() {},
  onOfflineReady() {}
});