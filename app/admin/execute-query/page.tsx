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
  deleteDoc,
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
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [editedRows, setEditedRows] = useState<Record<number, Record<string, any>>>({})
  const [tableName, setTableName] = useState<string | null>(null)



  

  // 🔹 SELECT results
  const [resultRows, setResultRows] = useState<any[]>([])

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

      const queriesSnap = await getDocs(collection(db, "queries"))
      setQueries(
        queriesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Query[]
      )

      if (role === "admin") {
        const clientsSnap = await getDocs(collection(db, "clients"))
        setClients(
          clientsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c: any) => c.status === "active") as Client[]
        )
        } else {
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
    setResultRows([])

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
      toast({
        title: "Error",
        description: err.message || "Execution failed",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  
  /* ================= FETCH SELECT RESULTS ================= */
  async function fetchSelectResults(resultsPath: string) {
    const rowsRef = collection(db, `${resultsPath}/rows`)
    const snap = await getDocs(rowsRef)

    return snap.docs
      .map((d) => d.data())
      .sort((a, b) => (a._rowIndex ?? 0) - (b._rowIndex ?? 0))
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

        if (updated.status === "success") {
          if (
            updated.queryType === "select" &&
            updated.resultsPath &&
            typeof updated.resultsPath === "string"
          ) {
            await fetchColumnOrder(updated.resultsPath)
            
            const rows = await fetchSelectResults(updated.resultsPath)
            setResultRows(rows)
            // ✅ STORE COLUMN ORDER
         
          }
          setPolling(false)
        }

        if (updated.status === "failed") {
          setPolling(false)
        }
      } catch (err) {
        console.error("[ExecuteQuery] polling error:", err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [polling, command])


  async function fetchColumnOrder(resultsPath: string) {
  const metaSnap = await getDoc(doc(db, resultsPath))

  if (metaSnap.exists()) {
    const data = metaSnap.data()
    if (Array.isArray(data.columnOrder)) {
      setColumnOrder(data.columnOrder)
    }
     if (typeof data.tableName === "string") {
    setTableName(data.tableName)
  }
  }
}
  /* ================= DELETE RESULTS ================= */
 async function deleteTempQueryResult(resultsPath: string) {
  // Delete rows
  const rowsRef = collection(db, `${resultsPath}/rows`)
  const rowsSnap = await getDocs(rowsRef)

  for (const row of rowsSnap.docs) {
    await deleteDoc(row.ref)
  }

  // Delete parent document (combinedId)
  await deleteDoc(doc(db, resultsPath))

  // Clear UI state
  setResultRows([])
  toast({
    title: "Results deleted",
    description: "Current execution results removed",
  })
}

// Format cell value for display
function formatCellValue(value: any) {
  // Firestore Timestamp
  if (value && typeof value === "object" && "seconds" in value) {
    const date = new Date(value.seconds * 1000)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}` // yyyy-mm-dd
  }

  return String(value ?? "")
}

// Build UPDATE SQL statement
function buildUpdateSQL(
  table: string,
  originalRow: any,
  changes: Record<string, any>
) {
  const setClause = Object.entries(changes)
    .map(([col, val]) => `${col} = ${toSqlValue(val)}`)
    .join(", ")

  // 🔑 Row identity (generic rule: all *id columns)
  const whereClause = Object.entries(originalRow)
    .filter(([k]) => k.toLowerCase().endsWith("id"))
    .map(([k, v]) => `${k} = ${toSqlValue(v)}`)
    .join(" AND ")

  if (!whereClause) {
    throw new Error("No WHERE clause keys found for update")
  }

  return `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause};
  `
}



// Save edits to database
async function saveEdits() {
  try {
    if (!tableName) {
      toast({
        title: "Error",
        description: "Table name not available",
        variant: "destructive",
      })
      return
    }

    if (Object.keys(editedRows).length === 0) {
      toast({
        title: "No changes",
        description: "Nothing to save",
      })
      return
    }

    // Build UPDATE SQL for each edited row
    const sqlStatements = Object.entries(editedRows).map(
      ([rowIndex, changes]) =>
        buildUpdateSQL(
          tableName,
          resultRows[Number(rowIndex)],
          changes
        )
    )

    // Send UPDATE command to agent
    await addDoc(collection(db, "commands"), {
      clientId: selectedClientId,
      status: "pending",
      isCustom: true,
      sql: sqlStatements.join("\n"),
      createdAt: serverTimestamp(),
    })

    toast({
      title: "Update submitted",
      description: "Changes sent to local database",
    })

    // Clear local edits
    setEditedRows({})
  } catch (err: any) {
    console.error("Save edits error:", err)

    toast({
      title: "Update failed",
      description: err.message || "Could not submit updates",
      variant: "destructive",
    })
  }
  if (command?.resultsPath && typeof command.resultsPath === "string") {
    deleteTempQueryResult(command.resultsPath)
    }
}


// Handle cell change
function handleCellChange(
  rowIndex: number,
  column: string,
  value: string
) {
  setEditedRows((prev) => ({
    ...prev,
    [rowIndex]: {
      ...(prev[rowIndex] ?? {}),
      [column]: value,
    },
  }))
}


// Convert value to SQL-compatible format
function toSqlValue(value: any) {
  // Firestore Timestamp → yyyy-mm-dd
  if (value && typeof value === "object" && "seconds" in value) {
    const date = new Date(value.seconds * 1000)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `'${y}-${m}-${d}'`
  }

  if (value === "" || value === null || value === undefined) {
    return "NULL"
  }

  if (!isNaN(Number(value))) {
    return value
  }

  return `'${String(value).replace(/'/g, "''")}'`
}









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
                          value={variables[v]}
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

          <CardContent className="space-y-4">
            {!command ? (
              <p className="text-muted-foreground">No execution yet</p>
            ) : (
              <>
                <Badge>{command.status}</Badge>

                {command.status === "failed" && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {command.error || "Execution failed"}
                    </AlertDescription>
                  </Alert>
                )}

                {resultRows.length > 0 && command && (
                <>
                  <div className="overflow-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead>
                          <tr>
                            {columnOrder.map((col) => (
                              <th key={col} className="border px-2 py-1 text-left">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                          <tbody>
                              {resultRows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {columnOrder.map((col) => (
                                    <td key={col} className="border px-2 py-1">
                                      <Input
                                        className="h-8"
                                        value={
                                          editedRows[rowIndex]?.[col] ??
                                          formatCellValue(row[col])
                                        }
                                        onChange={(e) =>
                                          handleCellChange(rowIndex, col, e.target.value)
                                        }
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>




                    </table>
                     <Button
                      type="button"
                      className="mt-3"
                      disabled={Object.keys(editedRows).length === 0}
                      onClick={saveEdits}
                    >
                      Save Changes
                    </Button>
                  </div>

                  {/* 🗑 DELETE BUTTON */}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      if (command?.resultsPath && typeof command.resultsPath === "string") {
                        deleteTempQueryResult(command.resultsPath)
                      }
                    }}
                  >
                    Delete Execution Results
                  </Button>
                </>
              )}

              </>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
