"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"

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
import { Loader2, Download, FileText, Trash2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
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
  query as firestoreQuery,
  where,
  orderBy,
} from "firebase/firestore"

import * as XLSX from "xlsx"

type QueryType = "select" | "non-select" | null

export default function AgentReportsPage() {
  const { toast } = useToast()

  const [queries, setQueries] = useState<Query[]>([])
  const [selectedQueryId, setSelectedQueryId] = useState("")
  const [variables, setVariables] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const [commandId, setCommandId] = useState<string | null>(null)
  const [combinedId, setCombinedId] = useState<string | null>(null)

  const [queryType, setQueryType] = useState<QueryType>(null)
  const [resultMessage, setResultMessage] = useState("")

  const [rows, setRows] = useState<any[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [headers, setHeaders] = useState<string[]>([])

  const [agentClientId, setAgentClientId] = useState("")
  const [agentUid, setAgentUid] = useState("")

  const [downloading, setDownloading] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  // Refs
  const rowsUnsubscribeRef = useRef<(() => void) | null>(null)
  const metaUnsubscribeRef = useRef<(() => void) | null>(null)

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const user = auth.currentUser
      if (!user) return

      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (!userDoc.exists()) return

      const clientId = userDoc.data().clientId
      setAgentClientId(clientId)
      setAgentUid(user.uid)

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
    setPolling(true)
    setCommandId(null)
    setCombinedId(null)
    setRows([])
    setColumnOrder([])
    setHeaders([])
    setQueryType(null)
    setResultMessage("")

    // Clean up any previous listeners
    if (rowsUnsubscribeRef.current) {
      rowsUnsubscribeRef.current()
      rowsUnsubscribeRef.current = null
    }
    if (metaUnsubscribeRef.current) {
      metaUnsubscribeRef.current()
      metaUnsubscribeRef.current = null
    }

    try {
      const user = auth.currentUser
      if (!user) throw new Error("User not authenticated")

      const ref = await addDoc(collection(db, "commands"), {
        clientId: agentClientId,
        agentUid: user.uid,
        queryId: selectedQueryId,
        variables,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      setCommandId(ref.id)
      
      // Create the combined ID that the agent will use
      const combinedId = `${ref.id}_${user.uid}`
      setCombinedId(combinedId)

      toast({
        title: "Query submitted",
        description: "Processing...",
      })
    } catch (err: any) {
      setLoading(false)
      setPolling(false)
      toast({
        title: "Error",
        description: err.message || "Failed to run query",
        variant: "destructive",
      })
    }
  }

  /* ================= LISTEN FOR COMMAND STATUS ================= */
  useEffect(() => {
    if (!commandId || !agentUid) return

    // Listen for command status changes
    const unsubCommand = onSnapshot(doc(db, "commands", commandId), (snap) => {
      if (!snap.exists()) return

      const data = snap.data()
      console.log("Command status update:", data.status, data.queryType)

      if (data.status === "success") {
        setPolling(false)
        setLoading(false)

        setQueryType(data.queryType)
        setResultMessage(data.result || "")

        // If SELECT query, listen for results
        if (data.queryType === "select") {
          const combinedIdFromData = data.resultsId || `${commandId}_${agentUid}`
          listenForResults(combinedIdFromData)
          
          // Also try to get column order from command if available
          if (data.columnOrder && Array.isArray(data.columnOrder)) {
            setColumnOrder(data.columnOrder)
            setHeaders(data.columnOrder)
            console.log("Column order from command:", data.columnOrder)
          }
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

      if (data.status === "running") {
        console.log("Query is running...")
      }
    })

    return () => {
      unsubCommand()
    }
  }, [commandId, agentUid])

  /* ================= LISTEN FOR RESULTS WITH COLUMN ORDER ================= */
  const listenForResults = (currentCombinedId: string) => {
    // Clean up previous listeners
    if (rowsUnsubscribeRef.current) {
      rowsUnsubscribeRef.current()
    }
    if (metaUnsubscribeRef.current) {
      metaUnsubscribeRef.current()
    }

    console.log("🎯 Listening for results with combinedId:", currentCombinedId)
    setCombinedId(currentCombinedId)

    // Listen to meta document (stored directly at temp_query_results/{combinedId})
    const metaRef = doc(db, "temp_query_results", currentCombinedId)
    const unsubMeta = onSnapshot(metaRef, (metaSnap) => {
      if (metaSnap.exists()) {
        const metaData = metaSnap.data()
        console.log("📋 Meta data received:", metaData)
        
        // Get column order from meta document
        if (metaData.columnOrder && Array.isArray(metaData.columnOrder)) {
          console.log("✅ Column order from meta:", metaData.columnOrder)
          setColumnOrder(metaData.columnOrder)
          setHeaders(metaData.columnOrder)
        } else {
          console.warn("⚠️ No column order in meta document")
          
          // If no column order but we have rowCount > 0, wait for first row
          if (metaData.rowCount > 0 && rows.length === 0) {
            console.log("Waiting for rows to determine column order...")
          }
        }
      } else {
        console.warn("Meta document not found yet")
      }
    }, (error) => {
      console.error("Error listening to meta:", error)
    })

    // Listen to rows collection
    const rowsRef = collection(db, "temp_query_results", currentCombinedId, "rows")
    const q = firestoreQuery(rowsRef, orderBy("_rowIndex")) // Order by row index if available
    
    const unsubRows = onSnapshot(q, (rowsSnap) => {
      const docs = rowsSnap.docs.map(d => {
        const data = d.data()
        // Remove internal metadata fields for display
        const { _storedAt, _rowIndex, ...cleanData } = data
        return cleanData
      })
      
      console.log("📊 Rows received:", docs.length)
      setRows(docs)
      
      // If we have rows but no column order from meta, extract from first row
      if (docs.length > 0 && columnOrder.length === 0) {
        const firstRow = docs[0]
        const keys = Object.keys(firstRow).filter(k => !k.startsWith('_'))
        console.log("⚠️ Column order extracted from first row:", keys)
        setColumnOrder(keys)
        setHeaders(keys)
      }
    }, (error) => {
      console.error("Error listening to rows:", error)
    })

    metaUnsubscribeRef.current = unsubMeta
    rowsUnsubscribeRef.current = unsubRows
  }

  /* ================= CLEANUP ON UNMOUNT ================= */
  useEffect(() => {
    return () => {
      if (rowsUnsubscribeRef.current) {
        rowsUnsubscribeRef.current()
      }
      if (metaUnsubscribeRef.current) {
        metaUnsubscribeRef.current()
      }
    }
  }, [])

  /* ================= EXPORT TO EXCEL WITH CORRECT COLUMN ORDER ================= */
  const exportToExcel = async () => {
    if (!rows.length) {
      toast({
        title: "No data",
        description: "No data available to export",
        variant: "destructive",
      })
      return
    }

    setDownloading(true)
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new()
      
      // Determine which column order to use
      const exportColumnOrder = columnOrder.length > 0 ? columnOrder : 
                               headers.length > 0 ? headers : 
                               Object.keys(rows[0]).filter(k => !k.startsWith('_'))
      
      console.log("Exporting with column order:", exportColumnOrder)
      console.log("Sample row:", rows[0])
      
      // Prepare data in correct column order
      const orderedData = rows.map((row, rowIndex) => {
        const orderedRow: any = {}
        exportColumnOrder.forEach(col => {
          // Handle undefined/null values
          const value = row[col]
          orderedRow[col] = value !== undefined && value !== null ? value : ''
        })
        return orderedRow
      })
      
      // Create main data sheet with preserved column order
      const worksheet = XLSX.utils.json_to_sheet(orderedData, {
        header: exportColumnOrder
      })
      
      // Auto-size columns
      const colWidths: { width: number }[] = []
      
      exportColumnOrder.forEach((col, idx) => {
        const headerWidth = col ? col.length : 10
        
        // Find max data width for this column
        let maxDataWidth = 0
        rows.forEach((row) => {
          const value = row[col]
          if (value !== undefined && value !== null) {
            const strValue = String(value)
            maxDataWidth = Math.max(maxDataWidth, strValue.length)
          }
        })
        
        colWidths.push({ 
          width: Math.max(headerWidth, maxDataWidth, 10) + 2 
        })
      })
      
      worksheet['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data")
      
      // Create info sheet
      const infoData = [
        ["Report Information"],
        ["Query Name:", selectedQuery?.name || 'Unknown'],
        ["Generated:", new Date().toLocaleString()],
        ["Total Rows:", rows.length.toString()],
        ["Total Columns:", exportColumnOrder.length.toString()],
        ["Column Order Preserved:", columnOrder.length > 0 ? "Yes" : "No"],
        ["Column Source:", columnOrder.length > 0 ? "From SQL Query" : "From Object Keys"],
        [""],
        ["Column Headers (in order):"],
        ...exportColumnOrder.map((col, idx) => [`${idx + 1}. ${col}`])
      ]
      const infoSheet = XLSX.utils.aoa_to_sheet(infoData)
      XLSX.utils.book_append_sheet(workbook, infoSheet, "Report Info")
      
      // Generate filename
      const safeQueryName = selectedQuery?.name?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'query'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `report_${safeQueryName}_${timestamp}.xlsx`
      
      // Download file
      XLSX.writeFile(workbook, fileName)
      
      toast({
        title: "Export successful",
        description: `"${fileName}" downloaded with ${rows.length} rows`,
      })
      await deleteCurrentUserTempResults()
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to generate Excel file",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  /* ================= DELETE TEMP RESULTS ================= */
  /* ================= DELETE ONLY CURRENT USER'S TEMP RESULTS ================= */
  const deleteCurrentUserTempResults = async () => {
    if (!commandId || !agentUid) {
      console.log("No commandId or agentUid, skipping cleanup")
      return
    }

    setCleaning(true)
    try {
      // Clean up listener first
      if (rowsUnsubscribeRef.current) {
        rowsUnsubscribeRef.current()
        rowsUnsubscribeRef.current = null
      }

      console.log("Deleting temp results for user:", agentUid, "command:", commandId)
      
      // METHOD 1: Delete by combined ID (agent's specific results)
      const combinedId = `${commandId}_${agentUid}`
      
      // Delete rows subcollection
      const rowsRef = collection(db, "temp_query_results", combinedId, "rows")
      const rowsSnap = await getDocs(rowsRef)
      const deleteRowsPromises = rowsSnap.docs.map(d => deleteDoc(d.ref))
      
      // Delete meta document
      const metaRef = doc(db, "temp_query_results", combinedId)
      const deleteMetaPromise = deleteDoc(metaRef).catch(err => {
        console.log("Meta document might not exist:", err.message)
      })
      
      // Wait for all deletions
      await Promise.all([...deleteRowsPromises, deleteMetaPromise])
      console.log("Deleted results for combined ID:", combinedId)

      // METHOD 2: Also query and delete any results with agentUid metadata
      const tempResultsRef = collection(db, "temp_query_results")
      const q = firestoreQuery(
        tempResultsRef,
        where("agentUid", "==", agentUid)
      )
      
      const agentResultsSnap = await getDocs(q)
      const otherDeletions = agentResultsSnap.docs.map(async (docSnap) => {
        const resultId = docSnap.id
        
        // Delete rows subcollection
        const otherRowsRef = collection(db, "temp_query_results", resultId, "rows")
        const otherRowsSnap = await getDocs(otherRowsRef)
        const deleteOtherRows = otherRowsSnap.docs.map(d => deleteDoc(d.ref))
        
        // Delete meta document
        await Promise.all([...deleteOtherRows, deleteDoc(docSnap.ref)])
        console.log("Deleted additional result:", resultId)
      })
      
      await Promise.all(otherDeletions)

      // Clear UI state
      setRows([])
      setHeaders([])
      setQueryType(null)
      setResultMessage("")
      
      console.log("Cleanup completed successfully for user:", agentUid)

    } catch (error) {
      console.error("Error deleting user temp results:", error)
      // Don't show error toast here to avoid interrupting download success
    } finally {
      setCleaning(false)
    }
  }


  /* ================= MANUAL REFRESH ================= */
  const refreshResults = async () => {
    if (!combinedId) return
    
    console.log("🔄 Refreshing results for:", combinedId)
    
    // Clear current state
    setRows([])
    setColumnOrder([])
    setHeaders([])
    
    // Re-listen to results
    listenForResults(combinedId)
    
    toast({
      title: "Refreshing",
      description: "Fetching latest results...",
    })
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate Custom Report</h1>
        <p className="text-muted-foreground">
          Run a query and export the results with preserved column order
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
                      value={variables[v] ?? ""}
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

        {/* EXPORT PANEL */}
        <Card>
          <CardHeader>
            <CardTitle>Export Results</CardTitle>
            <CardDescription>
              {combinedId && `ID: ${combinedId.substring(0, 12)}...`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {queryType === "select" && rows.length > 0 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Query Results</p>
                    <div className="flex items-center gap-2">
                      {columnOrder.length > 0 && (
                        <div className="flex items-center text-xs text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Preserved order
                        </div>
                      )}
                      <Button
                        onClick={refreshResults}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded">
                      <span className="text-muted-foreground">Rows:</span>
                      <span className="ml-2 font-semibold">{rows.length}</span>
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <span className="text-muted-foreground">Columns:</span>
                      <span className="ml-2 font-semibold">{columnOrder.length || headers.length}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={exportToExcel}
                    disabled={downloading || cleaning}
                    className="w-full"
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {downloading ? "Downloading..." : "Download Excel"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Preserves SQL column order: {columnOrder.join(', ')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={deleteCurrentUserTempResults}
                    disabled={cleaning}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    {cleaning ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {cleaning ? "Deleting..." : "Delete Results"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Clears display and deletes from database
                  </p>
                </div>
              </>
            )}

            {queryType === "non-select" && (
              <div className="text-center p-4 border rounded bg-muted/50">
                <p className="font-medium">Non-Select Query</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {resultMessage}
                </p>
              </div>
            )}

            {polling && !queryType && (
              <div className="text-center p-4 border rounded bg-muted/50">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="mt-2 text-sm font-medium">Processing query...</p>
                <p className="text-xs text-muted-foreground">
                  Executing SQL query and storing results...
                </p>
                {combinedId && (
                  <p className="text-xs mt-2 font-mono">ID: {combinedId}</p>
                )}
              </div>
            )}

            {!queryType && !polling && rows.length === 0 && (
              <div className="text-center p-8 border rounded">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Run a query to see results here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      {/* DATA PREVIEW */}
      {queryType === "select" && rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>
                  {selectedQuery?.name} • {rows.length} rows • {columnOrder.length || headers.length} columns
                  {columnOrder.length > 0 && " • Preserved column order"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={refreshResults}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {(columnOrder.length > 0 ? columnOrder : headers).map((h, index) => (
                      <th key={h} className="px-4 py-3 text-left font-medium border-r">
                        <div className="flex items-center">
                          <span className="mr-2 text-xs text-muted-foreground">{index + 1}.</span>
                          <span className="truncate" title={h}>{h}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      {(columnOrder.length > 0 ? columnOrder : headers).map(h => (
                        <td key={h} className="px-4 py-2 border-r">
                          {row[h] === undefined || row[h] === null ? (
                            <span className="text-muted-foreground italic">null</span>
                          ) : typeof row[h] === 'object' ? (
                            JSON.stringify(row[h])
                          ) : (
                            String(row[h])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <div className="p-3 border-t bg-muted/20 text-center text-sm text-muted-foreground">
                  Showing first 10 of {rows.length} rows. Download full dataset for complete results.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}