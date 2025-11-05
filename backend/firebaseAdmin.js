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

export const sendBroadcastNotification = async (title, body) => {
  const message = {
    data: { title, body }, // Using 'data' is still best
    topic: "all_users",
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Successfully sent broadcast message:", response);
  } catch (error) {
    console.error("Error sending broadcast message:", error);
  }
};