"use client"

import { CreateClientDialog } from "@/components/create-client-dialog"
import { ClientsTable } from "@/components/clients-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import type { Client } from "@/types"
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore"
import { auth } from "@/lib/firebase-client"

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("admin")

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const user = auth.currentUser
      if (!user) return

      const idTokenResult = await user.getIdTokenResult()
      const role = (idTokenResult.claims.role as string) || "admin"
      setUserRole(role)

      const db = getFirestore()
      const clientsRef = collection(db, "clients")
      const q = query(clientsRef, orderBy("createdAt", "desc"))
      const snapshot = await getDocs(q)

      let clientsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[]

      if (role === "engineer") {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const assignedClients = userData.assignedClients || []

          console.log("[v0] Engineer assigned clients:", assignedClients)
          clientsData = clientsData.filter((client) => assignedClients.includes(client.id))
        }
      }

      console.log("[v0] Fetched clients:", clientsData.length)
      setClients(clientsData)
    } catch (error) {
      console.error("[v0] Failed to fetch clients:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            {userRole === "engineer"
              ? "Manage your assigned client accounts"
              : "Manage client accounts and their configurations"}
          </p>
        </div>
        {userRole === "admin" && <CreateClientDialog onSuccess={fetchClients} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{userRole === "engineer" ? "Assigned Clients" : "All Clients"}</CardTitle>
          <CardDescription>
            {userRole === "engineer"
              ? "View and manage client accounts assigned to you"
              : "View and manage all client accounts in the system"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-muted-foreground">Loading clients...</p>
            </div>
          ) : (
            <ClientsTable clients={clients} onUpdate={fetchClients} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
