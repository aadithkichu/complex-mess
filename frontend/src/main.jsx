import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Mount the React app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 🔹 Register the PWA Service Worker (auto-managed by Vite plugin)
registerSW({
  onNeedRefresh() {
    console.log("🔄 New content available, refresh to update.");
  },
  onOfflineReady() {
    console.log("✅ App ready to work offline.");
  },
});

// 🔹 Register Firebase Messaging Service Worker (for push notifications)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .then(reg => console.log('✅ Firebase Messaging SW registered:', reg.scope))
    .catch(err => console.error('❌ Firebase Messaging SW registration failed:', err));
}
