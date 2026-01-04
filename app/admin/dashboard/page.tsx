"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCog, Database, Activity } from "lucide-react"
import { useEffect, useState } from "react"
import { db, auth } from "@/lib/firebase-client"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"

export default function DashboardPage() {
  const [stats, setStats] = useState({
    clients: 0,
    agents: 0,
    configs: 0,
    queries: 0,
  })
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("admin")

  useEffect(() => {
    async function fetchStats() {
      try {
        const user = auth.currentUser
        if (!user) return

        const idTokenResult = await user.getIdTokenResult()
        const role = (idTokenResult.claims.role as string) || "admin"
        setUserRole(role)

        const [clientsSnap, usersSnap, configsSnap, commandsSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "db_configs")),
          getDocs(collection(db, "commands")),
        ])

        let clientsData = clientsSnap.docs.map((doc) => doc.data())
        let agentsData = usersSnap.docs.map((doc) => doc.data()).filter((u: any) => u.role === "agent")
        let configsData = configsSnap.docs.map((doc) => doc.data())
        let commandsData = commandsSnap.docs.map((doc) => doc.data())

        if (role === "engineer") {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          const assignedClients = userDoc.data()?.assignedClients || []

          clientsData = clientsData.filter((c: any) => assignedClients.includes(c.id))
          agentsData = agentsData.filter((a: any) => assignedClients.includes(a.clientId))
          configsData = configsData.filter((conf: any) => assignedClients.includes(conf.clientId))
          commandsData = commandsData.filter((cmd: any) => assignedClients.includes(cmd.clientId))
        }

        setStats({
          clients: clientsData.length,
          agents: agentsData.length,
          configs: configsData.length,
          queries: commandsData.length,
        })
      } catch (error) {
        console.error("[v0] Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {userRole === "engineer" ? "Welcome to your engineer control panel" : "Welcome to the admin control panel"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === "engineer" ? "Assigned Clients" : "Total Clients"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.clients}</div>
            <p className="text-xs text-muted-foreground">Active client accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === "engineer" ? "Assigned Agents" : "Total Agents"}
            </CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.agents}</div>
            <p className="text-xs text-muted-foreground">Agent accounts created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DB Configurations</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.configs}</div>
            <p className="text-xs text-muted-foreground">Database credentials stored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queries Executed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : stats.queries}</div>
            <p className="text-xs text-muted-foreground">Total queries run</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">No recent activity</div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current operational status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">Firebase Auth</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">Firestore</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
