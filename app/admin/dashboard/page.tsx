"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { db, auth } from "@/lib/firebase-client"
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCog, Database, Activity } from "lucide-react"

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<"admin" | "engineer" | "agent">("admin")
  const [stats, setStats] = useState({
    clients: 0,
    agents: 0,
    configs: 0,
    queries: 0,
  })

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)

      const user = auth.currentUser
      if (!user) return

      const token = await user.getIdTokenResult()
      const userRole = (token.claims.role as "admin" | "engineer" | "agent") || "admin"
      setRole(userRole)

      /* ===================== ADMIN ===================== */
      if (userRole === "admin") {
        const [clientsSnap, usersSnap, configsSnap, commandsSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "db_configs")),
          getDocs(collection(db, "commands")),
        ])

        setStats({
          clients: clientsSnap.size,
          agents: usersSnap.docs.filter((d) => d.data().role === "agent").length,
          configs: configsSnap.size,
          queries: commandsSnap.size,
        })

        return
      }

      /* ===================== ENGINEER ===================== */

      // 1️⃣ Read engineer's OWN user document
      const userSnap = await getDoc(doc(db, "users", user.uid))
      if (!userSnap.exists()) {
        setStats({ clients: 0, agents: 0, configs: 0, queries: 0 })
        return
      }

      const assignedClients: string[] = userSnap.data().assignedClients || []

      /* ---------- Clients ---------- */
      const clientDocs = await Promise.all(assignedClients.map((cid) => getDoc(doc(db, "clients", cid))))
      const validClients = clientDocs.filter((d) => d.exists())

      /* ---------- DB Configs ---------- */
      const configDocs = await Promise.all(assignedClients.map((cid) => getDoc(doc(db, "db_configs", cid))))
      const validConfigs = configDocs.filter((d) => d.exists())

      /* ---------- Agents (per client) ---------- */
      let agentCount = 0
      for (const cid of assignedClients) {
        const q = query(collection(db, "users"), where("role", "==", "agent"), where("clientId", "==", cid))
        const snap = await getDocs(q)
        agentCount += snap.size
      }

      /* ---------- Commands (per client) ---------- */
      let commandCount = 0
      for (const cid of assignedClients) {
        const q = query(collection(db, "commands"), where("clientId", "==", cid))
        const snap = await getDocs(q)
        commandCount += snap.size
      }

      setStats({
        clients: validClients.length,
        agents: agentCount,
        configs: validConfigs.length,
        queries: commandCount,
      })
    } catch (err) {
      console.error("[Dashboard] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {role === "engineer" ? "Engineer Dashboard" : role === "agent" ? "Agent Dashboard" : "Admin Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {role === "engineer"
            ? "Welcome to your engineer control panel"
            : role === "agent"
              ? "Welcome to your agent control panel"
              : "Welcome to the admin control panel"}
        </p>
      </div>

      {role !== "agent" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={role === "engineer" ? "Assigned Clients" : "Total Clients"}
            value={stats.clients}
            icon={<Users />}
            loading={loading}
          />
          <StatCard
            title={role === "engineer" ? "Assigned Agents" : "Total Agents"}
            value={stats.agents}
            icon={<UserCog />}
            loading={loading}
          />
          <StatCard title="DB Configurations" value={stats.configs} icon={<Database />} loading={loading} />
          <StatCard title="Queries Executed" value={stats.queries} icon={<Activity />} loading={loading} />
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string
  value: number
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "…" : value}</div>
        <p className="text-xs text-muted-foreground">Live count</p>
      </CardContent>
    </Card>
  )
}
