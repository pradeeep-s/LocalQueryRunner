"use client"

import { useState, useEffect } from "react"
import { CreateQueryDialog } from "@/components/create-query-dialog"
import { QueriesTable } from "@/components/queries-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShieldAlert } from "lucide-react"
import { db } from "@/lib/firebase-client"
import { collection, getDocs } from "firebase/firestore"
import type { Query } from "@/types"

export default function QueriesPage() {
  const [queries, setQueries] = useState<Query[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchQueries() {
      try {
        const queriesSnap = await getDocs(collection(db, "queries"))
        const queriesData = queriesSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Query[]
        setQueries(queriesData)
      } catch (error) {
        console.error("[v0] Error fetching queries:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchQueries()
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    window.location.reload()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queries</h1>
          <p className="text-muted-foreground">Manage predefined SQL queries for execution</p>
        </div>
        <CreateQueryDialog onSuccess={handleRefresh} />
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Only predefined queries can be executed. Users cannot run arbitrary SQL to ensure security and data integrity.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Predefined Queries</CardTitle>
          <CardDescription>SQL queries available for execution with client data</CardDescription>
        </CardHeader>
        <CardContent>
          <QueriesTable queries={queries} onDelete={handleRefresh} />
        </CardContent>
      </Card>
    </div>
  )
}
