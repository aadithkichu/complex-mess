import express from "express";
import { sendPushNotification } from "../firebaseAdmin.js";

const router = express.Router();

router.post("/notify", async (req, res) => {
  const { token, title, body } = req.body;
  await sendPushNotification(token, title, body);
  res.json({ success: true });
});

export default router;
