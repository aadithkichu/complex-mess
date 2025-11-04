// firebaseAdmin.js
import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./serviceAccountKey.json", import.meta.url))
);

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
