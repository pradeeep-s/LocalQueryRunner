import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Code } from "lucide-react"

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard Setup</h1>
          <p className="text-muted-foreground mt-2">
            Follow these steps to configure your admin user and start using the dashboard
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            You need to complete these setup steps before you can access the admin dashboard.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: Verify Firebase Configuration</CardTitle>
            <CardDescription>Ensure all Firebase environment variables are set</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 font-mono text-sm">
              <p className="text-muted-foreground mb-2">Required environment variables:</p>
              <ul className="space-y-1">
                <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
                <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
                <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
                <li>FIREBASE_PROJECT_ID</li>
                <li>FIREBASE_PRIVATE_KEY</li>
                <li>FIREBASE_CLIENT_EMAIL</li>
                <li>ENCRYPTION_KEY</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Create Admin User in Firebase Console</CardTitle>
            <CardDescription>Set up your first admin user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li>Go to Firebase Console → Authentication → Users</li>
              <li>Click &quot;Add User&quot;</li>
              <li>Enter email and password for your admin account</li>
              <li>Click &quot;Add User&quot;</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Set Admin Custom Claims</CardTitle>
            <CardDescription>Grant admin privileges using Firebase Admin SDK</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Code className="h-4 w-4" />
              <AlertTitle>Run this in your terminal or Firebase Cloud Functions</AlertTitle>
              <AlertDescription>You need to use Firebase Admin SDK to set custom claims</AlertDescription>
            </Alert>

            <div className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
              <pre>{`// Using Node.js with Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize if not already initialized
admin.initializeApp();

// Set admin claim for user
async function makeUserAdmin(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, {
    role: 'admin'
  });
  console.log('Admin claim set for:', email);
}

// Replace with your admin email
makeUserAdmin('your-admin@example.com');`}</pre>
            </div>

            <Alert className="border-green-600">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Alternative: Firebase CLI</AlertTitle>
              <AlertDescription>
                You can also use Firebase CLI extensions or create a temporary Cloud Function to set claims
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 4: Login to Admin Dashboard</CardTitle>
            <CardDescription>Access the dashboard with your admin credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Once custom claims are set:</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>
                Go to <code className="bg-muted px-2 py-1 rounded">/login</code>
              </li>
              <li>Enter your admin email and password</li>
              <li>You will be redirected to the admin dashboard</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium">Getting &quot;Access denied&quot; error?</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                <li>Verify custom claims are set correctly (role: &quot;admin&quot;)</li>
                <li>Check browser console for detailed logs starting with [v0]</li>
                <li>Ensure user has signed out and signed back in after setting claims</li>
                <li>Verify Firebase environment variables are correct</li>
              </ul>
            </div>

            <div>
              <p className="font-medium">Firebase Admin SDK errors?</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                <li>Check FIREBASE_PRIVATE_KEY is properly formatted (includes \n for line breaks)</li>
                <li>Verify FIREBASE_CLIENT_EMAIL matches your service account</li>
                <li>Ensure FIREBASE_PROJECT_ID is correct</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
