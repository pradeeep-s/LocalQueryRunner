"use client"

import { CreateClientDialog } from "@/components/create-client-dialog"
import { ClientsTable } from "@/components/clients-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import type { Client } from "@/types"
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore"

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const db = getFirestore()
      const clientsRef = collection(db, "clients")
      const q = query(clientsRef, orderBy("createdAt", "desc"))
      const snapshot = await getDocs(q)

      const clientsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[]

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
          <p className="text-muted-foreground">Manage client accounts and their configurations</p>
        </div>
        <CreateClientDialog onSuccess={fetchClients} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>View and manage all client accounts in the system</CardDescription>
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
