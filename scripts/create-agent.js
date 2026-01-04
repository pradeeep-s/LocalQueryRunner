/**
 * Create Agent Script
 *
 * This script creates a Firebase Auth user for an agent and sets up
 * the necessary custom claims and Firestore documents.
 *
 * Requirements:
 * - Node.js installed
 * - firebase-admin package: npm install firebase-admin
 * - serviceAccountKey.json in the same directory
 *
 * Usage:
 *   node create-agent.js <clientId> <clientName>
 *
 * Example:
 *   node create-agent.js client_001 "Acme Corp"
 */

const admin = require("firebase-admin")
const crypto = require("crypto")

// Initialize Firebase Admin
try {
  const serviceAccount = require("./serviceAccountKey.json")

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  console.log("✓ Firebase Admin initialized\n")
} catch (error) {
  console.error("✗ Error: Could not load serviceAccountKey.json")
  console.error("  Download it from Firebase Console → Project Settings → Service Accounts")
  process.exit(1)
}

// Generate secure random password
function generatePassword(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
  let password = ""
  const randomBytes = crypto.randomBytes(length)

  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length]
  }

  return password
}

// Main function to create agent
async function createAgent(clientId, clientName) {
  try {
    console.log("Creating agent for client:", clientName)
    console.log("Client ID:", clientId)
    console.log("")

    // Generate credentials
    const email = `agent_${clientId}@app.com`
    const password = generatePassword(16)

    // Create Firebase Auth user
    console.log("Step 1: Creating Firebase Auth user...")
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      emailVerified: false,
      disabled: false,
    })

    console.log("✓ User created with UID:", userRecord.uid)

    // Set custom claims
    console.log("Step 2: Setting custom claims...")
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "agent",
      clientId: clientId,
    })

    console.log('✓ Custom claims set: { role: "agent", clientId: "' + clientId + '" }')

    // Create Firestore document
    console.log("Step 3: Creating Firestore document...")
    const db = admin.firestore()
    await db.collection("users").doc(userRecord.uid).set({
      email: email,
      role: "agent",
      clientId: clientId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log("✓ Firestore document created in users/" + userRecord.uid)
    console.log("")

    // Display credentials
    console.log("═══════════════════════════════════════════════════════")
    console.log("  AGENT CREATED SUCCESSFULLY")
    console.log("═══════════════════════════════════════════════════════")
    console.log("")
    console.log("  Client:", clientName)
    console.log("  Client ID:", clientId)
    console.log("  Email:", email)
    console.log("  Password:", password)
    console.log("  UID:", userRecord.uid)
    console.log("")
    console.log("  ⚠️  IMPORTANT: Save these credentials securely!")
    console.log("  This is the ONLY time the password will be displayed.")
    console.log("")
    console.log("═══════════════════════════════════════════════════════")
  } catch (error) {
    console.error("")
    console.error("✗ Error creating agent:", error.message)

    if (error.code === "auth/email-already-exists") {
      console.error("  This email already exists. Each client can only have one agent.")
    } else if (error.code === "auth/invalid-email") {
      console.error("  Invalid email format.")
    }

    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length < 2) {
  console.log("Usage: node create-agent.js <clientId> <clientName>")
  console.log("")
  console.log("Example:")
  console.log('  node create-agent.js client_001 "Acme Corp"')
  process.exit(1)
}

const [clientId, clientName] = args

// Validate clientId format
if (!clientId.startsWith("client_")) {
  console.error('Error: clientId must start with "client_"')
  console.error("Example: client_001, client_abc123")
  process.exit(1)
}

// Run the script
createAgent(clientId, clientName)
  .then(() => {
    console.log("")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Unexpected error:", error)
    process.exit(1)
  })
