import express from "express";
import { sendPushNotification } from "../firebaseAdmin.js";
import { sendBroadcastNotification } from "../firebaseAdmin.js";
import { RecommendationModel } from '../models/recommendationModel.js';
import { CycleModel } from '../models/cycleModel.js';
import admin from "firebase-admin";

const router = express.Router();

router.post("/notify", async (req, res) => {
  const { token, title, body } = req.body;
  await sendPushNotification(token, title, body);
  res.json({ success: true });
});

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PERIOD_ORDER = {
  "Morning": 1,
  "Noon": 2,
  "Evening": 3
};

router.post("/send-mess-notification", async (req, res) => {
  try {
    // 1. Check Secret
    const providedSecret = req.header("X-Cron-Secret");
    if (providedSecret !== process.env.CRON_SECRET) {
      return res.status(401).send("Unauthorized");
    }

    // 2. Get period
    const { period } = req.body;
    if (!period || !PERIOD_ORDER[period]) {
      return res.status(400).send("A valid period (Morning, Noon, Evening) is required.");
    }

    console.log(`Cron job running for: ${period}`);
    console.log("Finding active cycle...");
    const cycle = await CycleModel.getCurrentActive(); // <-- Using your new function
    
    if (!cycle) {
        console.log("No active cycle found. Aborting.");
        return res.status(200).json({ message: 'No active cycle found.' });
    }
    console.log(`Found active cycle: ${cycle.cycle_id}`);

    // 3. Get recommendations
    const today = getTodayDateString();
    const allRecommendations =await RecommendationModel.generate(cycle);; 

    // 4. Abort if empty
    if (!allRecommendations || allRecommendations.length === 0) {
      console.log("No recommendations found from generate(). Aborting.");
      return res.status(200).send("No recommendations generated.");
    }

    // 5. Filter tasks based on your rules
    const currentPeriodOrder = PERIOD_ORDER[period];

    // Rule A: 'Mess Delivery' for *only* this date and period
    const deliveryTasks = allRecommendations.filter(task => 
      task.date === today &&
      task.period === period &&
      task.task_name === 'Mess Delivery'
    );

    // Rule B: 'Mess Cleaning' for *all dates <= today*
    // and for *today*, only periods <= currentPeriod
    const cleaningTasks = allRecommendations.filter(task => {
      if (task.task_name !== 'Mess Cleaning') {
        return false;
      }
      
      // ✅ YOUR CHANGE: Overdue tasks from previous days
      if (task.date < today) {
        return true;
      }

      // ✅ YOUR CHANGE: Tasks from today, up to this period
      if (task.date === today && PERIOD_ORDER[task.period] <= currentPeriodOrder) {
        return true;
      }
      
      return false; // Task is for a future period today, or a future date
    });

    // Combine the two lists
    const tasksToNotify = [...deliveryTasks, ...cleaningTasks];

    // 6. Abort if the final list is empty
    if (tasksToNotify.length === 0) {
      console.log(`No tasks found for ${today} up to ${period}. Aborting.`);
      return res.status(200).send("No tasks for this period.");
    }

    // 7. Build the notification message
    const title = `Mess Duty: ${period}`;
    const userTaskMap = new Map();

    for (const task of tasksToNotify) {
      if (!userTaskMap.has(task.user_name)) {
        userTaskMap.set(task.user_name, new Set());
      }
      
      // Include the date for overdue tasks
      const taskDate = (task.date === today) ? "" : `(${task.date}) `;
      const taskDetail = `${task.task_name} ${taskDate}(${task.period})`;
      
      userTaskMap.get(task.user_name).add(taskDetail);
    }

    const bodyLines = [];
    for (const [name, tasks] of userTaskMap.entries()) {
      bodyLines.push(`- ${name}: ${[...tasks].join(', ')}`);
    }
    const body = bodyLines.join('\n');
    
    // 8. Send the one broadcast notification to EVERYONE
    await sendBroadcastNotification(title, body);

    res.status(200).send("Broadcast notification sent with task details.");

  } catch (error) {
    console.error("Error in cron job endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/subscribe-to-topic", async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).send("Token is required.");
  }

  try {
    // This is the Firebase Admin command
    await admin.messaging().subscribeToTopic(token, "all_users");
    res.status(200).send("Subscribed to topic.");
  } catch (error) {
    console.error("Error subscribing to topic:", error);
    res.status(500).send("Server error.");
  }
});

export default router;
