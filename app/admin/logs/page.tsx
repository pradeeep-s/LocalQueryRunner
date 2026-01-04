"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase-client"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import type { Client, Query as QueryType, Command } from "@/types"

export default function LogsPage() {
  const [commands, setCommands] = useState<Command[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [queries, setQueries] = useState<QueryType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const commandsQuery = query(collection(db, "commands"), orderBy("createdAt", "desc"), limit(100))
        const [commandsSnap, clientsSnap, queriesSnap] = await Promise.all([
          getDocs(commandsQuery),
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "queries")),
        ])

        const commandsData = commandsSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Command[]

        const clientsData = clientsSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Client[]

        const queriesData = queriesSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as QueryType[]

        setCommands(commandsData)
        setClients(clientsData)
        setQueries(queriesData)
      } catch (error) {
        console.error("[v0] Error fetching logs:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    return client ? client.name : clientId
  }

  const getQueryName = (queryId: string) => {
    const query = queries.find((q) => q.id === queryId)
    return query ? query.name : queryId
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
        <p className="text-muted-foreground">View execution history and command status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Command Execution History</CardTitle>
          <CardDescription>Latest 100 query executions across all clients</CardDescription>
        </CardHeader>
        <CardContent>
          {commands.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <h3 className="mt-2 text-sm font-semibold">No logs</h3>
                <p className="mt-1 text-sm text-muted-foreground">Execute queries to see logs here.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Command ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commands.map((command) => (
                    <TableRow key={command.id}>
                      <TableCell className="font-mono text-sm">{command.id}</TableCell>
                      <TableCell>{getClientName(command.clientId)}</TableCell>
                      <TableCell className="font-medium">{getQueryName(command.queryId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            command.status === "success"
                              ? "default"
                              : command.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {command.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(command.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {command.completedAt ? new Date(command.completedAt).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
