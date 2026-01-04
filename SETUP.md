# Admin Dashboard Setup Guide

## Prerequisites
- Firebase Project created
- Firebase Authentication enabled
- Firestore Database created

## Step 1: Configure Firebase Environment Variables

Add these environment variables to your Vercel project or `.env.local` file:

\`\`\`env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin Configuration (for future server-side operations)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="your_private_key_with_newlines"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project_id.iam.gserviceaccount.com

# Encryption Key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_64_character_hex_string
\`\`\`

## Step 2: Deploy Firestore Security Rules

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Navigate to **Firestore Database** → **Rules**
4. Copy the contents of `firestore.rules` from this project
5. Paste into the Firebase Console rules editor
6. Click **Publish**

## Step 3: Create Admin User

### Option A: Firebase Console (Recommended)
1. Go to Firebase Console → **Authentication** → **Users**
2. Click **Add User**
3. Enter email: `admin@yourdomain.com`
4. Enter password (strong password recommended)
5. Click **Add User**

### Option B: Using Firebase CLI
\`\`\`bash
firebase auth:import users.json --project your-project-id
\`\`\`

## Step 4: Set Admin Custom Claims

You need to set custom claims using Firebase Admin SDK. Run this Node.js script:

\`\`\`javascript
// set-admin-claims.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminClaim(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    console.log(`✓ Admin claims set for ${email}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Replace with your admin email
setAdminClaim('admin@yourdomain.com');
\`\`\`

Run with:
\`\`\`bash
node set-admin-claims.js
\`\`\`

### Alternative: Using Firebase CLI Extension
\`\`\`bash
npm install -g firebase-tools
firebase login
firebase functions:config:set admin.email="admin@yourdomain.com"
\`\`\`

## Step 5: Verify Setup

1. Navigate to `/login`
2. Enter your admin credentials
3. You should be redirected to `/admin/dashboard`
4. Try creating a client to verify Firestore permissions

## Firestore Collections Structure

### clients
\`\`\`
{
  clientId: string (document ID)
  name: string
  status: 'active' | 'disabled'
  agentUid: string | null
  createdAt: timestamp
  lastSeen: timestamp | null
}
\`\`\`

### users
\`\`\`
{
  uid: string (document ID)
  email: string
  role: 'admin' | 'agent'
  clientId: string | null
  createdAt: timestamp
}
\`\`\`

### db_configs
\`\`\`
{
  clientId: string (document ID)
  host: string
  port: number
  database: string
  username: string (encrypted)
  password: string (encrypted)
  updatedAt: timestamp
}
\`\`\`

### queries
\`\`\`
{
  queryId: string (document ID)
  name: string
  sql: string
  variables: string[]
  createdAt: timestamp
}
\`\`\`

### commands
\`\`\`
{
  commandId: string (document ID)
  clientId: string
  queryId: string
  variables: object
  status: 'pending' | 'running' | 'success' | 'failed'
  result: any | null
  error: string | null
  createdAt: timestamp
  completedAt: timestamp | null
}
\`\`\`

## Troubleshooting

### "Missing or insufficient permissions" error
- Verify Firestore rules are deployed correctly
- Check that custom claims are set: `{ role: "admin" }`
- Ensure user is logged in (check browser console for auth state)
- Try logging out and logging back in to refresh token

### "google-gax" import errors
- This is a known limitation of Firebase Admin SDK in browser/edge environments
- All operations use client-side Firestore SDK instead
- Security is enforced via Firestore rules, not server-side

### Authentication not working
- Verify all environment variables are set correctly
- Check Firebase Console → Authentication is enabled
- Ensure email/password provider is enabled in Firebase Console

## Security Notes

1. **Never expose Firebase Admin credentials** in client-side code
2. **Always use HTTPS** in production
3. **Rotate encryption keys** regularly
4. **Set up Firestore rules** before going to production
5. **Enable email verification** for production users
6. **Use environment-specific Firebase projects** (dev/staging/prod)

## Deployment

Deploy to Vercel:
\`\`\`bash
vercel --prod
\`\`\`

Or use the GitHub integration for automatic deployments.
