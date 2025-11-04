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

// ✅ Register Firebase messaging SW only if not already present
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    const alreadyRegistered = regs.some(r => r.active?.scriptURL.includes('firebase-messaging-sw.js'));
    if (!alreadyRegistered) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('🔥 Firebase SW registered:', registration.scope);
        })
        .catch((err) => console.error('Firebase SW registration failed:', err));
    } else {
      console.log("⚡ Firebase SW already registered, skipping.");
    }
  });
}
