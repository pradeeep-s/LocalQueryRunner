"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Play, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Client, Query, Command } from "@/types"
import { db, auth } from "@/lib/firebase-client"
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore"

export default function ExecuteQueryPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedQueryId, setSelectedQueryId] = useState("")
  const [customSql, setCustomSql] = useState("")
  const [executionType, setExecutionType] = useState<"predefined" | "custom">("predefined")
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [command, setCommand] = useState<Command | null>(null)
  const [polling, setPolling] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchData() {
      try {
        const user = auth.currentUser
        if (!user) return

        const idTokenResult = await user.getIdTokenResult()
        const role = (idTokenResult.claims.role as string) || "admin"

        const [clientsSnap, queriesSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "queries")),
        ])

        let clientsData = clientsSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Client[]

        if (role === "engineer") {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          const assignedClients = userDoc.data()?.assignedClients || []
          clientsData = clientsData.filter((c) => assignedClients.includes(c.id))
        }

        const queriesData = queriesSnap.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Query[]

        setClients(clientsData.filter((c) => c.status === "active"))
        setQueries(queriesData)
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
      }
    }
    fetchData()
  }, [])

  const selectedQuery = queries.find((q) => q.id === selectedQueryId)

  useEffect(() => {
    if (selectedQuery) {
      const newVariables: Record<string, string> = {}
      selectedQuery.variables.forEach((v) => {
        newVariables[v] = ""
      })
      setVariables(newVariables)
    }
  }, [selectedQuery])

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (polling && command) {
      interval = setInterval(async () => {
        try {
          const commandDoc = await getDoc(doc(db, "commands", command.id))
          if (commandDoc.exists()) {
            const updatedCommand = { ...commandDoc.data(), id: commandDoc.id } as Command
            setCommand(updatedCommand)
            if (updatedCommand.status === "success" || updatedCommand.status === "failed") {
              setPolling(false)
            }
          }
        } catch (error) {
          console.error("[v0] Error fetching command:", error)
        }
      }, 2000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [polling, command])

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setCommand(null)

    try {
      const commandPayload: any = {
        clientId: selectedClientId,
        status: "pending",
        createdAt: serverTimestamp(),
      }

      if (executionType === "predefined") {
        commandPayload.queryId = selectedQueryId
        commandPayload.variables = variables
      } else {
        commandPayload.sql = customSql
        commandPayload.isCustom = true
      }

      const commandRef = await addDoc(collection(db, "commands"), commandPayload)

      toast({
        title: "Query submitted",
        description: `Your ${executionType} query has been submitted for execution.`,
      })

      const commandDoc = await getDoc(commandRef)
      if (commandDoc.exists()) {
        const initialCommand = { ...commandDoc.data(), id: commandDoc.id } as Command
        setCommand(initialCommand)
        setPolling(true)
      }
    } catch (error) {
      console.error("[v0] Error executing query:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to execute query",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Execute Query</h1>
        <p className="text-muted-foreground">Run predefined queries or execute custom SQL on connected clients</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Query Execution</CardTitle>
            <CardDescription>Select a client and define your query</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleExecute} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  disabled={loading || clients.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} ({client.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={executionType} onValueChange={(v) => setExecutionType(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="predefined">Predefined Queries</TabsTrigger>
                  <TabsTrigger value="custom">Custom SQL</TabsTrigger>
                </TabsList>

                <TabsContent value="predefined" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="query">Select Predefined Query</Label>
                    <Select
                      value={selectedQueryId}
                      onValueChange={setSelectedQueryId}
                      disabled={loading || queries.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a query" />
                      </SelectTrigger>
                      <SelectContent>
                        {queries.map((query) => (
                          <SelectItem key={query.id} value={query.id}>
                            {query.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedQuery && selectedQuery.variables.length > 0 && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h4 className="text-sm font-medium">Query Variables</h4>
                      {selectedQuery.variables.map((variable) => (
                        <div key={variable} className="space-y-2">
                          <Label htmlFor={variable}>{variable}</Label>
                          <Input
                            id={variable}
                            value={variables[variable] || ""}
                            onChange={(e) =>
                              setVariables({
                                ...variables,
                                [variable]: e.target.value,
                              })
                            }
                            disabled={loading}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-sql">SQL Query</Label>
                    <Textarea
                      id="custom-sql"
                      placeholder="SELECT * FROM users LIMIT 10"
                      className="font-mono text-sm min-h-[200px]"
                      value={customSql}
                      onChange={(e) => setCustomSql(e.target.value)}
                      disabled={loading}
                      required={executionType === "custom"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Warning: Use caution when running custom SQL queries directly on client databases.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  !selectedClientId ||
                  (executionType === "predefined" && !selectedQueryId) ||
                  (executionType === "custom" && !customSql.trim())
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Execute {executionType === "predefined" ? "Predefined" : "Custom"} Query
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Status</CardTitle>
            <CardDescription>Real-time status of your query execution</CardDescription>
          </CardHeader>
          <CardContent>
            {!command ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No query executed yet
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge
                    variant={
                      command.status === "success"
                        ? "default"
                        : command.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {command.status === "pending" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {command.status === "running" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {command.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Command ID</span>
                  <span className="font-mono text-sm text-muted-foreground">{command.id}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Created</span>
                  <span className="text-sm text-muted-foreground">{new Date(command.createdAt).toLocaleString()}</span>
                </div>

                {command.completedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completed</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(command.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}

                {command.status === "failed" && command.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{command.error}</AlertDescription>
                  </Alert>
                )}

                {command.status === "success" && command.result && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Result</span>
                    <div className="max-h-[200px] overflow-auto rounded-lg border bg-muted p-3">
                      <pre className="text-xs font-mono">{JSON.stringify(command.result, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
