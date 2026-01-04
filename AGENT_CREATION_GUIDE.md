# Agent Creation Guide

Since the admin dashboard runs in a browser environment, it cannot use Firebase Admin SDK to create Firebase Authentication users. Agents must be created using one of the following methods:

## Method 1: Using Node.js Script (Recommended)

Create agents locally using the provided script with Firebase Admin SDK.

### Setup

1. Install dependencies in a local Node.js project:
\`\`\`bash
npm install firebase-admin
\`\`\`

2. Download your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json`

3. Create the script below and run it

### Usage

\`\`\`bash
node create-agent.js <clientId> <clientName>
\`\`\`

Example:
\`\`\`bash
node create-agent.js client_001 "Acme Corp"
\`\`\`

This will:
- Create Firebase Auth user with email: `agent_<clientId>@app.com`
- Generate a random secure password
- Set custom claim: `{ role: "agent", clientId: "<clientId>" }`
- Create Firestore document in `users/{uid}` collection
- Display the credentials (save these securely!)

---

## Method 2: Firebase Console + Manual Setup

### Step 1: Create Firebase Auth User

1. Go to Firebase Console → Authentication → Users
2. Click "Add User"
3. Email: `agent_<clientId>@app.com` (e.g., `agent_client_001@app.com`)
4. Password: Generate a strong password
5. Click "Add User"

### Step 2: Set Custom Claims

You need to run this in your local environment with Firebase Admin SDK:

\`\`\`javascript
const admin = require('firebase-admin');

// Initialize with your service account
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

async function setAgentClaims(email, clientId) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, {
    role: 'agent',
    clientId: clientId
  });
  console.log(`Custom claims set for ${email}`);
}

// Usage
setAgentClaims('agent_client_001@app.com', 'client_001');
\`\`\`

### Step 3: Create Firestore Document

1. Go to Firebase Console → Firestore Database
2. Navigate to `users` collection
3. Create document with ID: `{uid}` (the UID from Authentication)
4. Add fields:
   \`\`\`
   email: "agent_client_001@app.com"
   role: "agent"
   clientId: "client_001"
   createdAt: [Timestamp - now]
   \`\`\`

---

## Method 3: Using Firebase CLI

\`\`\`bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Create user (requires Firebase Admin SDK script)
node create-agent-cli.js
\`\`\`

---

## Security Notes

- Agent passwords should be strong (16+ characters, mixed case, numbers, symbols)
- Store credentials securely (password manager)
- Share credentials securely with agents (encrypted email, secure portal)
- Agents should change passwords on first login (implement in your app)
- Regular password rotation policy recommended

---

## Troubleshooting

### Agent can't login
- Verify email format: `agent_<clientId>@app.com`
- Check custom claims are set: `role: "agent", clientId: "client_xxx"`
- Verify Firestore document exists in `users/{uid}`

### Agent has no access
- Check Firestore security rules allow agent role
- Verify clientId matches between Auth claims and Firestore doc

### Can't set custom claims
- Ensure you're using Firebase Admin SDK (server-side only)
- Verify service account has proper permissions
- Check you're using correct project ID
