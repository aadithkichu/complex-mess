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
export const messaging = getMessaging(app);

// Request permission and get FCM token
export const requestPermission = async () => {
  console.log("Requesting notification permission...");
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    const token = await getToken(messaging, {
      vapidKey: "BFPkFUQD2wCyUvYc20QOGDmwi0QwrDebLVp_mIoT6Fb_oiswrqNePSzAfb4jsbFc3jd2pSeMQD-DI80naA-Yw4M", // from Firebase console
    });
    console.log("FCM Token:", token);
    return token;
  } else {
    console.log("Notification permission denied");
  }
};
