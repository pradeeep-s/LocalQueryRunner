"use client"

import type React from "react"
import { useState, useEffect } from "react"

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
import { Loader2, Download, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

import type { Query } from "@/types"
import { db, auth } from "@/lib/firebase-client"

import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore"

import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import "jspdf-autotable"

type QueryType = "select" | "non-select" | null

export default function AgentReportsPage() {
  const { toast } = useToast()

  const [queries, setQueries] = useState<Query[]>([])
  const [selectedQueryId, setSelectedQueryId] = useState("")
  const [variables, setVariables] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const [commandId, setCommandId] = useState<string | null>(null)

  const [queryType, setQueryType] = useState<QueryType>(null)
  const [resultMessage, setResultMessage] = useState("")

  const [rows, setRows] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])

  const [agentClientId, setAgentClientId] = useState("")
  const [agentUid, setAgentUid] = useState("")

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const user = auth.currentUser
      if (!user) return

      const token = await user.getIdTokenResult()
      const role = token.claims.role as string

      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (!userDoc.exists()) return

      const clientId = userDoc.data().clientId
      setAgentClientId(clientId)

      const queriesSnap = await getDocs(collection(db, "queries"))
      const allQueries = queriesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as Query[]

      const filtered = allQueries.filter(q =>
        (q.assignedAgents || []).includes(user.uid)
      )

      setQueries(filtered)
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: "Failed to load queries",
        variant: "destructive",
      })
    }
  }

  /* ================= QUERY SELECTION ================= */
  const selectedQuery = queries.find(q => q.id === selectedQueryId)

  useEffect(() => {
    if (!selectedQuery) return
    const vars: Record<string, string> = {}
    selectedQuery.variables.forEach(v => (vars[v] = ""))
    setVariables(vars)
  }, [selectedQuery])

  /* ================= EXECUTE QUERY ================= */
  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setPolling(false)
    setCommandId(null)
    setRows([])
    setHeaders([])
    setQueryType(null)
    setResultMessage("")

    try {
      const ref = await addDoc(collection(db, "commands"), {
        clientId: agentClientId,
        agentUid: agentUid,
        queryId: selectedQueryId,
        variables,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      setCommandId(ref.id)
      setPolling(true)

      toast({
        title: "Query submitted",
        description: "Processing...",
      })
    } catch (err: any) {
      setLoading(false)
      toast({
        title: "Error",
        description: err.message || "Failed to run query",
        variant: "destructive",
      })
    }
  }

  /* ================= POLLING COMMAND STATUS ================= */
  useEffect(() => {
    if (!polling || !commandId) return

    const interval = setInterval(async () => {
      const snap = await getDoc(doc(db, "commands", commandId))
      if (!snap.exists()) return

      const data = snap.data()

      if (data.status === "success") {
        setPolling(false)
        setLoading(false)

        setQueryType(data.queryType)
        setResultMessage(data.result || "")

        if (data.queryType === "select") {
          const rowsRef = collection(
            db,
            "temp_query_results",
            commandId,
            "rows"
          )

          onSnapshot(rowsRef, snapshot => {
            const docs = snapshot.docs.map(d => d.data())
            setRows(docs)
            if (docs.length > 0) {
              setHeaders(Object.keys(docs[0]))
            }
          })
        }

        toast({
          title: "Success",
          description: "Query executed successfully",
        })
      }

      if (data.status === "failed") {
        setPolling(false)
        setLoading(false)
        toast({
          title: "Error",
          description: data.error || "Query failed",
          variant: "destructive",
        })
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [polling, commandId])

     /* ================= COMPLETE CLEANUP TEMP RESULTS ================= */
async function cleanupAllTempResults() {
  try {
    const tempResultsRef = collection(db, "temp_query_results")
    const querySnap = await getDocs(tempResultsRef)
    
    // Delete all command documents and their subcollections
    const deletePromises = querySnap.docs.map(async (commandDoc) => {
      const commandId = commandDoc.id
      
      // Delete rows subcollection
      const rowsRef = collection(db, "temp_query_results", commandId, "rows")
      const rowsSnap = await getDocs(rowsRef)
      const deleteRows = rowsSnap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(deleteRows)
      
      // Delete meta subcollection if it exists
      const metaRef = collection(db, "temp_query_results", commandId, "meta")
      const metaSnap = await getDocs(metaRef)
      const deleteMeta = metaSnap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(deleteMeta)
      
      // Finally delete the command document itself
      await deleteDoc(doc(db, "temp_query_results", commandId))
    })
    
    await Promise.all(deletePromises)
    
    toast({
      title: "Cleanup complete",
      description: `All temporary results deleted successfully`,
    })
  } catch (error) {
    console.error("Error cleaning up all temp results:", error)
    toast({
      title: "Cleanup error",
      description: "Failed to delete temporary results",
      variant: "destructive",
    })
  }
}

/* ================= CLEANUP SINGLE COMMAND'S TEMP DATA ================= */
async function cleanupTempResults() {
  if (!commandId) return

  try {
    // Delete all rows
    const rowsRef = collection(db, "temp_query_results", commandId, "rows")
    const rowsSnap = await getDocs(rowsRef)
    const deleteRowsPromises = rowsSnap.docs.map(d => deleteDoc(d.ref))
    
    // Delete all meta documents if they exist
    const metaRef = collection(db, "temp_query_results", commandId, "meta")
    const metaSnap = await getDocs(metaRef)
    const deleteMetaPromises = metaSnap.docs.map(d => deleteDoc(d.ref))
    
    // Wait for all deletions
    await Promise.all([...deleteRowsPromises, ...deleteMetaPromises])
    
    // Finally delete the command document itself
    await deleteDoc(doc(db, "temp_query_results", commandId))
    
    // Also delete from commands collection
    const commandRef = doc(db, "commands", commandId)
    await deleteDoc(commandRef)

    toast({
      title: "Cleanup complete",
      description: "Temporary data removed successfully",
    })
  } catch (error) {
    console.error("Error cleaning up temp results:", error)
    toast({
      title: "Cleanup error",
      description: "Failed to remove temporary data",
      variant: "destructive",
    })
  }
}

  /* ================= EXPORT PDF ================= 
  const exportToPdf = async () => {
    if (!rows.length) return

    const pdf = new jsPDF()
    pdf.setFontSize(16)
    pdf.text("Report", 14, 15)
    pdf.setFontSize(10)
    pdf.text(`Query: ${selectedQuery?.name}`, 14, 25)
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)

    ;(pdf as any).autoTable({
      head: [headers],
      body: rows.map(r => headers.map(h => r[h])),
      startY: 40,
    })

    pdf.save(`report-${Date.now()}.pdf`)
    await cleanupTempResults()
  }
  */
  /* ================= EXPORT EXCEL ================= */
  const exportToExcel = async () => {
    if (!rows.length) return

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report")
    XLSX.writeFile(workbook, `report-${Date.now()}.xlsx`)
    await cleanupAllTempResults()
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate Custom Report</h1>
        <p className="text-muted-foreground">
          Select a query and variables
        </p>
      </div>

      <form onSubmit={handleExecute} className="grid gap-6 lg:grid-cols-3">
        {/* CONFIG */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Select query and variables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Query</Label>
              <Select value={selectedQueryId} onValueChange={setSelectedQueryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select query" />
                </SelectTrigger>
                <SelectContent>
                  {queries.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedQuery && selectedQuery.variables.length > 0 && (
              <div className="space-y-3 border rounded p-4 bg-muted/50">
                {selectedQuery.variables.map(v => (
                  <div key={v}>
                    <Label>{v}</Label>
                    <Input
                      value={variables[v]}
                      onChange={e =>
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

            <Button disabled={loading || !selectedQueryId} className="w-full">
              {loading ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {loading ? "Running..." : "Run Query"}
            </Button>
          </CardContent>
        </Card>

        {/* EXPORT */}
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queryType === "select" && rows.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Rows: {rows.length}, Columns: {headers.length}
                </p>
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" /> Excel
                </Button>
              </>
            )}

            {queryType === "non-select" && (
              <p className="text-sm text-muted-foreground text-center">
                {resultMessage}
              </p>
            )}
          </CardContent>
        </Card>
      </form>

      {/* PREVIEW */}
      {queryType === "select" && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
            <CardDescription>
              Generated at {new Date().toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {headers.map(h => (
                      <th key={h} className="px-4 py-2 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {headers.map(h => (
                        <td key={h} className="px-4 py-2">
                          {String(row[h])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing 10 of {rows.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
