// public/firebase-messaging-sw.js

// Use the compat SDKs for service workers
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ✅ Initialize Firebase (COMPAT syntax)
firebase.initializeApp({
  apiKey: "AIzaSyBFJgqrVPel6AZuODNS5oT1XC2F-84SdU8",
  authDomain: "complx-36878.firebaseapp.com",
  projectId: "complx-36878",
  storageBucket: "complx-36878.firebasestorage.app",
  messagingSenderId: "469355083143",
  appId: "1:469355083143:web:03bc7ff668989f09a20f22",
  measurementId: "G-LHK6FJY93G"
});

// ✅ Retrieve messaging
const messaging = firebase.messaging();

// ✅ Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const { title, body } = payload.data;

  const notificationOptions = {
    body,
    icon: '/icons/icon-192x192.png',
  };

  self.registration.showNotification(title, notificationOptions);
});
