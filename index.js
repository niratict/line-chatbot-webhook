require("dotenv").config(); // โหลดค่า Environment Variables จากไฟล์ .env (ใช้เฉพาะบน Local)

const express = require("express");
const { WebhookClient } = require("dialogflow-fulfillment");
const admin = require("firebase-admin");

// เชื่อมต่อ Firebase
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // แก้ปัญหา \n ใน Render.com
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const app = express();
app.use(express.json());

// ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่
app.get("/", (req, res) => {
  res.send("Webhook is running!");
});

// Webhook สำหรับ Dialogflow
app.post("/webhook", async (request, response) => {
  const agent = new WebhookClient({ request, response });

  async function handleFallback(agent) {
    const userId = agent.originalRequest.payload.data.source.userId;
    const db = admin.database();
    const userRef = db.ref(`users/${userId}`);

    const snapshot = await userRef.once("value");
    const userData = snapshot.val() || {};
    const lastFallbackTime = userData.lastFallbackTime || 0;
    const currentTime = Date.now();

    const COOLDOWN_PERIOD = 1800000; // 30 นาที

    if (currentTime - lastFallbackTime >= COOLDOWN_PERIOD) {
      await userRef.update({ lastFallbackTime: currentTime });
      agent.add("รบกวนรอเจ้าหน้าที่ฝ่ายบริการตอบกลับอีกครั้ง");
    } else {
      agent.add("");
    }
  }

  const intentMap = new Map();
  intentMap.set("Default Fallback Intent", handleFallback);
  agent.handleRequest(intentMap);
});

// กำหนดพอร์ต
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
