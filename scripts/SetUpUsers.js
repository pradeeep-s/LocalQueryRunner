import admin from "firebase-admin";
import fs from "fs";

// Load service account
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

// 👇 CHANGE THESE VALUES
const NEW_USER = {
  email: "agent_kosanam@firebase.com",
  password: "Agent@123",
  role: "agent"
};

async function createAgent() {
  try {
    // 1️⃣ Create Auth User
    const userRecord = await auth.createUser({
      email: NEW_USER.email,
      password: NEW_USER.password,
    });

    const uid = userRecord.uid;
    console.log("✅ Firebase Auth User Created:", uid);

    // 2️⃣ Set Custom Claim
    await auth.setCustomUserClaims(uid, {
      role: NEW_USER.role
    });

    console.log("✅ Custom claim set: agent");

    // 3️⃣ Insert into Firestore
    await db.collection("users").doc(uid).set({
      email: NEW_USER.email,
      role: NEW_USER.role,
      active: true,
      createdAt: new Date()
    });

    console.log("✅ User added to Firestore");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating user:", err.message);
    process.exit(1);
  }
}

createAgent();
