importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBFJgqrVPel6AZuODNS5oT1XC2F-84SdU8",
  authDomain: "complx-36878.firebaseapp.com",
  projectId: "complx-36878",
  storageBucket: "complx-36878.firebasestorage.app",
  messagingSenderId: "469355083143",
  appId: "1:469355083143:web:03bc7ff668989f09a20f22",
  measurementId: "G-LHK6FJY93G"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("Received background message ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icons/icon-192x192.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
