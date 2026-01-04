"use client"

import { CreateAgentDialog } from "@/components/create-agent-dialog"
import { AgentsTable } from "@/components/agents-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import type { Agent, Client } from "@/types"
import { db, auth } from "@/lib/firebase-client"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>("admin")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Fetching agents and clients from Firestore")

      const user = auth.currentUser
      if (!user) return

      const idTokenResult = await user.getIdTokenResult()
      const role = (idTokenResult.claims.role as string) || "admin"
      setUserRole(role)

      // Fetch clients
      const clientsSnapshot = await getDocs(collection(db, "clients"))
      let clientsData = clientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[]

      if (role === "engineer") {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const assignedClients = userData.assignedClients || []
          clientsData = clientsData.filter((client) => assignedClients.includes(client.id))
        }
      }

      setClients(clientsData)
      console.log("[v0] Fetched clients:", clientsData.length)

      // Fetch users (agents)
      const usersSnapshot = await getDocs(collection(db, "users"))
      let agentsData = usersSnapshot.docs
        .map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }))
        .filter((user: any) => user.role === "agent") as Agent[]

      if (role === "engineer") {
        const assignedClientIds = clientsData.map((c) => c.id)
        agentsData = agentsData.filter((agent) => assignedClientIds.includes(agent.clientId))
      }

      console.log("[v0] Fetched agents:", agentsData.length)
      setAgents(agentsData)
    } catch (error: any) {
      console.error("[v0] Failed to fetch data:", error.message)
      console.error("[v0] Error details:", error)

      if (error.code === "permission-denied" || error.message?.includes("permission")) {
        setError("Firestore rules not deployed. Please deploy firestore.rules from Firebase Console.")
      } else {
        setError(error.message || "Failed to fetch data")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            {userRole === "engineer"
              ? "Manage agents assigned to your clients"
              : "Manage agent accounts and their client assignments"}
          </p>
        </div>
        {userRole === "admin" && <CreateAgentDialog clients={clients} onSuccess={fetchData} />}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Permission Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <div className="mt-2">
              <p className="font-semibold mb-1">To fix this:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to Firebase Console → Firestore Database → Rules</li>
                <li>
                  Copy the content from the <code>firestore.rules</code> file in this project
                </li>
                <li>Paste it into the rules editor and click "Publish"</li>
              </ol>
              <Button onClick={fetchData} variant="outline" size="sm" className="mt-3 bg-transparent">
                Retry After Deploying Rules
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {userRole === "admin" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Agent Creation Requires Manual Setup</AlertTitle>
          <AlertDescription>
            Agent accounts must be created manually in Firebase Console due to environment limitations. See
            AGENT_CREATION_GUIDE.md for detailed instructions or use the scripts/create-agent.js script.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{userRole === "engineer" ? "Assigned Agents" : "All Agents"}</CardTitle>
          <CardDescription>
            {userRole === "engineer"
              ? "View agents assigned to your clients"
              : "View and manage all agent accounts in the system"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-muted-foreground">Loading agents...</p>
            </div>
          ) : error ? (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-muted-foreground">Fix the permission error above to view agents</p>
            </div>
          ) : (
            <AgentsTable agents={agents} clients={clients} onUpdate={fetchData} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
