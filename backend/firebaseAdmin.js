import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const sendPushNotification = async (token, title, body) => {
  const message = {
    notification: { title, body },
    token,
  };
  await admin.messaging().send(message);
  console.log("✅ Notification sent");
};
