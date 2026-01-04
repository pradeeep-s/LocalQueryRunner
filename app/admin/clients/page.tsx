"use client"

import { CreateClientDialog } from "@/components/create-client-dialog"
import { ClientsTable } from "@/components/clients-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useEffect, useState } from "react"
import type { Client } from "@/types"
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore"
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
      setLoading(true)

      const user = auth.currentUser
      if (!user) return

      // 🔑 Get role from custom claims
      const idTokenResult = await user.getIdTokenResult()
      const role = (idTokenResult.claims.role as string) || "admin"
      setUserRole(role)

      const db = getFirestore()

      /* ===================== ADMIN ===================== */
      if (role === "admin") {
        const q = query(
          collection(db, "clients"),
          orderBy("createdAt", "desc")
        )

        const snapshot = await getDocs(q)

        const clientsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Client[]

        setClients(clientsData)
        return
      }

      /* ===================== ENGINEER ===================== */

      // 1️⃣ Read engineer's OWN user document
      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      )

      if (!userDoc.exists()) {
        console.error("Engineer user document not found")
        setClients([])
        return
      }

      const assignedClients: string[] =
        userDoc.data().assignedClients || []

      console.log("[v0] Engineer assigned clients:", assignedClients)

      // 2️⃣ Fetch ONLY assigned client documents
      const clientDocs = await Promise.all(
        assignedClients.map((clientId: string) =>
          getDoc(doc(db, "clients", clientId))
        )
      )

      const clientsData = clientDocs
        .filter((d) => d.exists())
        .map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Client[]

      setClients(clientsData)

    } catch (error) {
      console.error("[v0] Failed to fetch clients:", error)
      setClients([])
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

        {userRole === "admin" && (
          <CreateClientDialog onSuccess={fetchClients} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {userRole === "engineer" ? "Assigned Clients" : "All Clients"}
          </CardTitle>
          <CardDescription>
            {userRole === "engineer"
              ? "Clients assigned to you"
              : "All client accounts in the system"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-muted-foreground">Loading clients...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-muted-foreground">
                No clients assigned
              </p>
            </div>
          ) : (
            <ClientsTable clients={clients} onUpdate={fetchClients} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
