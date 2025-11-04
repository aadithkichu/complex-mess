// src/firebase.js

import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBFJgqrVPel6AZuODNS5oT1XC2F-84SdU8",
  authDomain: "complx-36878.firebaseapp.com",
  projectId: "complx-36878",
  storageBucket: "complx-36878.firebasestorage.app",
  messagingSenderId: "469355083143",
  appId: "1:469355083143:web:03bc7ff668989f09a20f22",
  measurementId: "G-LHK6FJY93G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// ✅ Exported function to request permission and get FCM token
export async function requestPermissionAndGetToken() {
  console.log("Requesting notification permission...");
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    const token = await getToken(messaging, {
      vapidKey: "BFPkFUQD2wCyUvYc20QOGDmwi0QwrDebLVp_mIoT6Fb_oiswrqNePSzAfb4jsbFc3jd2pSeMQD-DI80naA-Yw4M", // replace with your VAPID key
    });
    console.log("✅ FCM Token:", token);
    return token;
  } else {
    console.log("❌ Permission not granted for notifications");
    return null;
  }
}

// ✅ Export messaging so other modules can listen for messages
export { messaging, onMessage };
