"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Play } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

import type { Client, Query, Command } from "@/types"
import { db, auth } from "@/lib/firebase-client"
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"

export default function ExecuteQueryPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedQueryId, setSelectedQueryId] = useState("")
  const [executionType, setExecutionType] =
    useState<"predefined" | "custom">("predefined")
  const [customSql, setCustomSql] = useState("")
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [command, setCommand] = useState<Command | null>(null)
  const [polling, setPolling] = useState(false)
  const [loading, setLoading] = useState(false)

  const { toast } = useToast()

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const user = auth.currentUser
      if (!user) return

      const token = await user.getIdTokenResult()
      const role = (token.claims.role as string) || "admin"

      /* ----------- LOAD ALL PREDEFINED QUERIES (CLAIM-BASED) ----------- */
      const queriesSnap = await getDocs(collection(db, "queries"))
      setQueries(
        queriesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Query[]
      )

      /* ----------- LOAD CLIENTS ----------- */
      if (role === "admin") {
        // Admin can read all clients
        const clientsSnap = await getDocs(collection(db, "clients"))
        setClients(
          clientsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c: any) => c.status === "active") as Client[]
        )
      } else {
        // Engineer: ID-based client reads only
        const userSnap = await getDoc(doc(db, "users", user.uid))
        if (!userSnap.exists()) return

        const assignedClients: string[] =
          userSnap.data().assignedClients || []

        const clientDocs = await Promise.all(
          assignedClients.map((cid) => getDoc(doc(db, "clients", cid)))
        )

        setClients(
          clientDocs
            .filter((d) => d.exists())
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c: any) => c.status === "active") as Client[]
        )
      }
    } catch (err) {
      console.error("[ExecuteQuery] init error:", err)
    }
  }

  /* ================= VARIABLES ================= */
  const selectedQuery = queries.find((q) => q.id === selectedQueryId)

  useEffect(() => {
    if (!selectedQuery) return
    const vars: Record<string, string> = {}
    selectedQuery.variables.forEach((v) => (vars[v] = ""))
    setVariables(vars)
  }, [selectedQuery])

  /* ================= EXECUTE ================= */
  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setCommand(null)

    try {
      const payload: any = {
        clientId: selectedClientId,
        status: "pending",
        createdAt: serverTimestamp(),
      }

      if (executionType === "predefined") {
        payload.queryId = selectedQueryId
        payload.variables = variables
      } else {
        payload.sql = customSql
        payload.isCustom = true
      }

      const ref = await addDoc(collection(db, "commands"), payload)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        setCommand({ id: snap.id, ...snap.data() } as Command)
        setPolling(true)
      }

      toast({
        title: "Query submitted",
        description: "Execution started",
      })
    } catch (err: any) {
      console.error("[ExecuteQuery] error:", err)
      toast({
        title: "Error",
        description: err.message || "Execution failed",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  /* ================= POLLING ================= */
  useEffect(() => {
    if (!polling || !command) return

    const interval = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, "commands", command.id))
        if (!snap.exists()) return

        const updated = { id: snap.id, ...snap.data() } as Command
        setCommand(updated)

        if (updated.status === "success" || updated.status === "failed") {
          setPolling(false)
        }
      } catch (err) {
        console.error("[ExecuteQuery] polling error:", err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [polling, command])

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Execute Query</h1>

      <form onSubmit={handleExecute} className="grid gap-6 lg:grid-cols-2">
        {/* LEFT */}
        <Card>
          <CardHeader>
            <CardTitle>Execution</CardTitle>
            <CardDescription>Select client and query</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Client</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs
              value={executionType}
              onValueChange={(v) =>
                setExecutionType(v as "predefined" | "custom")
              }
            >
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="predefined">Predefined</TabsTrigger>
                <TabsTrigger value="custom">Custom SQL</TabsTrigger>
              </TabsList>

              <TabsContent value="predefined" className="space-y-3">
                <Select
                  value={selectedQueryId}
                  onValueChange={setSelectedQueryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select query" />
                  </SelectTrigger>
                  <SelectContent>
                    {queries.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedQuery && selectedQuery.variables.length > 0 && (
                  <div className="space-y-3 border rounded p-3">
                    {selectedQuery.variables.map((v) => (
                        <div key={v}>
                          <Label>{v}</Label>
                          <Input
                            value={variables[v] ?? ""}
                            onChange={(e) =>
                              setVariables({
                                ...variables,
                                [v]: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom">
                <Textarea
                  value={customSql}
                  onChange={(e) => setCustomSql(e.target.value)}
                  className="min-h-[200px] font-mono"
                  required
                />
              </TabsContent>
            </Tabs>

            <Button
              type="submit"
              disabled={
                loading ||
                !selectedClientId ||
                (executionType === "predefined" && !selectedQueryId) ||
                (executionType === "custom" && !customSql.trim())
              }
            >
              {loading ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <Play className="mr-2" />
              )}
              Execute
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            {!command ? (
              <p className="text-muted-foreground">No execution yet</p>
            ) : (
              <Badge>{command.status}</Badge>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
