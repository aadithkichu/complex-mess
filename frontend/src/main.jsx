import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ✅ Register the PWA service worker (for offline use)
const updateSW = registerSW({
  immediate: true, // optional
  onNeedRefresh() {
    console.log("🔄 New content available. Refresh to update.");
  },
  onOfflineReady() {
    console.log("✅ App ready to work offline.");
  },
});