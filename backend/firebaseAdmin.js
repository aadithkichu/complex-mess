import admin from "firebase-admin";
import "dotenv/config";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const sendPushNotification = async (token, title, body) => {
  await admin.messaging().send({
    token,
    notification: { title, body },
  });
  console.log("✅ Notification sent to:", token);
};
