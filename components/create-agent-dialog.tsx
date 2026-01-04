"use client"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import type { Client } from "@/types"

interface CreateAgentDialogProps {
  clients: Client[]
  onSuccess: () => void
}

export function CreateAgentDialog({ clients, onSuccess }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Agent Creation Instructions</DialogTitle>
          <DialogDescription>
            Due to environment limitations, agents must be created manually in Firebase Console
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              This environment doesn't support Firebase Admin SDK. Follow these steps to create agents manually.
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="pt-6">
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>
                  <strong>Go to Firebase Console</strong> → Authentication → Users
                </li>
                <li>
                  <strong>Add User</strong> with email:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">agent_[clientId]@app.com</code>
                </li>
                <li>
                  <strong>Generate a strong password</strong> (min 12 characters)
                </li>
                <li>
                  <strong>Set custom claims</strong> using Firebase CLI or Admin SDK:
                  <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto">
                    {`{
  "role": "agent",
  "clientId": "client_xxx"
}`}
                  </pre>
                </li>
                <li>
                  <strong>Create Firestore document</strong> in{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">users/[uid]</code>:
                  <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto">
                    {`{
  "email": "agent_xxx@app.com",
  "role": "agent",
  "clientId": "client_xxx",
  "createdAt": "[ISO timestamp]"
}`}
                  </pre>
                </li>
                <li>
                  <strong>Update client document</strong> in{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">clients/[clientId]</code>:
                  <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto">
                    {`{
  "agentUid": "[agent-uid]"
}`}
                  </pre>
                </li>
              </ol>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            See <code>SETUP.md</code> for complete documentation including Firebase CLI commands.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
