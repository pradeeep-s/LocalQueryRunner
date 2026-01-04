# Deploy Firestore Security Rules

## The Problem
You're getting "Missing or insufficient permissions" because Firestore security rules haven't been deployed yet.

## Solution: Deploy the Rules (Choose One Method)

### Method 1: Firebase Console (Easiest)

1. **Open Firebase Console**: Go to https://console.firebase.google.com
2. **Select Your Project**: Click on "localqueryrunner" project
3. **Navigate to Firestore**: Click "Firestore Database" in left sidebar
4. **Open Rules Tab**: Click the "Rules" tab at the top
5. **Copy and Paste**: Copy ALL content from `firestore.rules` file and paste it into the editor
6. **Publish**: Click the "Publish" button
7. **Wait**: Rules take 1-2 minutes to propagate

### Method 2: Firebase CLI (For Developers)

\`\`\`bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done)
firebase init firestore

# Deploy the rules
firebase deploy --only firestore:rules
\`\`\`

### Method 3: Quick Copy-Paste Rules

If you want to manually copy, here are the complete rules:

\`\`\`
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && request.auth.token.role == 'admin';
    }
    
    // Helper function to check if user is an agent
    function isAgent() {
      return request.auth != null && request.auth.token.role == 'agent';
    }
    
    // Helper function to get agent's clientId
    function getAgentClientId() {
      return request.auth.token.clientId;
    }
    
    // Clients collection - Admin only
    match /clients/{clientId} {
      allow read, write: if isAdmin();
    }
    
    // Users collection - Admin only
    match /users/{userId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
      allow get: if isAdmin();
      allow list: if isAdmin();
    }
    
    // Database configs - Admin only
    match /db_configs/{configId} {
      allow read, write: if isAdmin();
    }
    
    // Queries - Admin can read/write, Agents can read queries for their client
    match /queries/{queryId} {
      allow read, write: if isAdmin();
      allow read: if isAgent() && resource.data.clientId == getAgentClientId();
    }
    
    // Commands - Admin can read/write all, Agents can read/write for their client
    match /commands/{commandId} {
      allow read, write: if isAdmin();
      allow read, write: if isAgent() && resource.data.clientId == getAgentClientId();
    }
    
    // Logs - Admin only
    match /logs/{logId} {
      allow read, write: if isAdmin();
    }
  }
}
\`\`\`

## Verification

After deploying, test by:
1. Refresh your admin dashboard
2. Navigate to /admin/agents
3. You should see the agents page load without errors

## What These Rules Do

- **Admin users** (with `role: "admin"` custom claim) can read/write ALL collections
- **Agent users** (with `role: "agent"` custom claim) can only access queries and commands for their assigned client
- **Unauthenticated users** have NO access to any data

## Troubleshooting

### Still getting permission errors?
- Wait 2-3 minutes after publishing rules
- Clear browser cache and refresh
- Verify your admin user has `role: "admin"` custom claim in Firebase Console
- Check Firebase Console → Firestore → Rules tab to confirm rules are published

### Rules won't save?
- Make sure you're on the Blaze (pay-as-you-go) plan
- Check for syntax errors in the rules editor
- Ensure you clicked "Publish" after pasting

## Security Notes

These rules ensure:
- Only authenticated admins can manage the system
- Database credentials are encrypted before storage
- Agents can only see data for their assigned client
- No public access to any sensitive data
