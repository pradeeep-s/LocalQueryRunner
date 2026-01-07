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
import { Loader2, Download, FileText, Trash2 } from "lucide-react"
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

  const [queryType, setQueryType] = useState<QueryType>(null)
  const [resultMessage, setResultMessage] = useState("")

  const [rows, setRows] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])

  const [agentClientId, setAgentClientId] = useState("")
  const [agentUid, setAgentUid] = useState("")

  const [downloading, setDownloading] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  // Refs
  const rowsUnsubscribeRef = useRef<(() => void) | null>(null)

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
    setRows([])
    setHeaders([])
    setQueryType(null)
    setResultMessage("")

    // Clean up any previous listeners
    if (rowsUnsubscribeRef.current) {
      rowsUnsubscribeRef.current()
      rowsUnsubscribeRef.current = null
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
    if (!commandId) return

    // Listen for command status changes
    const unsubCommand = onSnapshot(doc(db, "commands", commandId), (snap) => {
      if (!snap.exists()) return

      const data = snap.data()

      if (data.status === "success") {
        setPolling(false)
        setLoading(false)

        setQueryType(data.queryType)
        setResultMessage(data.result || "")

        // If SELECT query, listen for results
        if (data.queryType === "select") {
          listenForResults(commandId, data.resultsPath || data.resultsId)
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
    })

    return () => {
      unsubCommand()
    }
  }, [commandId])

  /* ================= LISTEN FOR RESULTS ================= */
  const listenForResults = (currentCommandId: string, resultsPath?: string) => {
    // Clean up previous listener if exists
    if (rowsUnsubscribeRef.current) {
      rowsUnsubscribeRef.current()
    }

    // Try to get results using different methods
    const getResultsRef = async () => {
      if (resultsPath) {
        // If we have a direct path from the agent
        const pathParts = resultsPath.split('/')
        if (pathParts.length === 2) {
          // Format: temp_query_results/{combinedId}
          return collection(db, pathParts[0], pathParts[1], "rows")
        }
      }

      // Method 1: Try combined ID format
      const combinedId = `${currentCommandId}_${agentUid}`
      return collection(db, "temp_query_results", combinedId, "rows")
    }

    getResultsRef().then(rowsRef => {
      const unsubResults = onSnapshot(rowsRef, (rowsSnap) => {
        const docs = rowsSnap.docs.map(d => d.data())
        setRows(docs)
        if (docs.length > 0) {
          setHeaders(Object.keys(docs[0]))
        }
      }, (error) => {
        console.error("Error listening to results:", error)
        // Try alternative method if first fails
        tryAlternativeResultsListen(currentCommandId)
      })

      rowsUnsubscribeRef.current = unsubResults
    }).catch(err => {
      console.error("Error setting up results listener:", err)
      // Try alternative method
      tryAlternativeResultsListen(currentCommandId)
    })
  }

  /* ================= ALTERNATIVE RESULTS LISTENING ================= */
  const tryAlternativeResultsListen = (currentCommandId: string) => {
    // Try to find results by querying metadata
    const tempResultsRef = collection(db, "temp_query_results")
    const q = firestoreQuery(
      tempResultsRef,
      where("originalCommandId", "==", currentCommandId),
      where("originalAgentUid", "==", agentUid)
    )

    const unsubMeta = onSnapshot(q, (metaSnap) => {
      if (!metaSnap.empty) {
        const metaDoc = metaSnap.docs[0]
        const combinedId = metaDoc.id
        
        // Now listen to rows
        const rowsRef = collection(db, "temp_query_results", combinedId, "rows")
        const unsubRows = onSnapshot(rowsRef, (rowsSnap) => {
          const docs = rowsSnap.docs.map(d => d.data())
          setRows(docs)
          if (docs.length > 0) {
            setHeaders(Object.keys(docs[0]))
          }
        })
        
        rowsUnsubscribeRef.current = () => {
          unsubMeta()
          unsubRows()
        }
      }
    })
  }

  /* ================= CLEANUP ON UNMOUNT ================= */
  useEffect(() => {
    return () => {
      // Clean up Firestore listeners when component unmounts
      if (rowsUnsubscribeRef.current) {
        rowsUnsubscribeRef.current()
      }
    }
  }, [])

  /* ================= EXPORT EXCEL - DELETE ONLY USER'S RESULTS ================= */
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
      
      // Create main data sheet
      const worksheet = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
      
      // Create info sheet
      const infoData = [
        ["Report Information"],
        ["Query Name:", selectedQuery?.name || "Unknown"],
        ["Generated:", new Date().toLocaleString()],
        ["Total Rows:", rows.length.toString()],
        ["Total Columns:", headers.length.toString()],
        [""],
        ["Column Headers:"],
        ...headers.map(h => [h])
      ]
      const infoSheet = XLSX.utils.aoa_to_sheet(infoData)
      XLSX.utils.book_append_sheet(workbook, infoSheet, "Info")
      
      // Generate filename
      const fileName = `report-${selectedQuery?.name?.replace(/\s+/g, '_') || 'query'}-${new Date().toISOString().slice(0, 10)}.xlsx`
      
      // Download file
      XLSX.writeFile(workbook, fileName)
      
      toast({
        title: "Export successful",
        description: `File "${fileName}" downloaded`,
      })

      // Now delete ONLY the current user's temp results
      await deleteCurrentUserTempResults()

    } catch (error) {
      console.error("Error exporting to Excel:", error)
      toast({
        title: "Export failed",
        description: "Failed to generate Excel file",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

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

  /* ================= CLEAR UI ONLY (NO DATABASE DELETE) ================= */
  const clearCurrentResults = () => {
    // Clear only UI state
    setRows([])
    setHeaders([])
    setQueryType(null)
    setResultMessage("")
    setCommandId(null)
    setPolling(false)
    
    // Clean up listener
    if (rowsUnsubscribeRef.current) {
      rowsUnsubscribeRef.current()
      rowsUnsubscribeRef.current = null
    }
    
    toast({
      title: "Results cleared",
      description: "Display results have been cleared",
    })
  }

  /* ================= DELETE ALL TEMP DATA FOR CURRENT USER ================= */
  const handleCleanupAllUserTempData = async () => {
    if (!agentUid) {
      toast({
        title: "Not authenticated",
        description: "Please login first",
        variant: "destructive",
      })
      return
    }

    setCleaning(true)
    try {
      // Query ALL temp results for this user
      const tempResultsRef = collection(db, "temp_query_results")
      const q = firestoreQuery(
        tempResultsRef,
        where("agentUid", "==", agentUid)
      )
      
      const userResultsSnap = await getDocs(q)
      
      // Also get results with combined IDs containing agentUid
      const allResultsSnap = await getDocs(tempResultsRef)
      
      const deletePromises: Promise<void>[] = []
      
      // Delete results with agentUid field
      userResultsSnap.docs.forEach(docSnap => {
        const resultId = docSnap.id
        deletePromises.push(
          (async () => {
            // Delete rows subcollection
            const rowsRef = collection(db, "temp_query_results", resultId, "rows")
            const rowsSnap = await getDocs(rowsRef)
            const deleteRows = rowsSnap.docs.map(d => deleteDoc(d.ref))
            
            // Delete meta document
            await Promise.all([...deleteRows, deleteDoc(docSnap.ref)])
          })()
        )
      })
      
      // Delete results with combined IDs containing agentUid
      allResultsSnap.docs.forEach(docSnap => {
        const docId = docSnap.id
        if (docId.includes(agentUid) && !userResultsSnap.docs.find(d => d.id === docId)) {
          deletePromises.push(
            (async () => {
              // Delete rows subcollection
              const rowsRef = collection(db, "temp_query_results", docId, "rows")
              const rowsSnap = await getDocs(rowsRef)
              const deleteRows = rowsSnap.docs.map(d => deleteDoc(d.ref))
              
              // Delete meta document
              await Promise.all([...deleteRows, deleteDoc(docSnap.ref)])
            })()
          )
        }
      })
      
      await Promise.all(deletePromises)

      // Clear current UI
      clearCurrentResults()
      
      toast({
        title: "Cleanup complete",
        description: `Deleted ${userResultsSnap.size} temporary result(s) for your account`,
      })

    } catch (error) {
      console.error("Error cleaning up user temp data:", error)
      toast({
        title: "Cleanup failed",
        description: "Failed to delete temporary data",
        variant: "destructive",
      })
    } finally {
      setCleaning(false)
    }
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate Custom Report</h1>
        <p className="text-muted-foreground">
          Run a query and export the results
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
              Download data after query execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {queryType === "select" && rows.length > 0 && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Query Results</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded">
                      <span className="text-muted-foreground">Rows:</span>
                      <span className="ml-2 font-semibold">{rows.length}</span>
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <span className="text-muted-foreground">Columns:</span>
                      <span className="ml-2 font-semibold">{headers.length}</span>
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
                    Downloads and clears YOUR results only
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={clearCurrentResults}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Display
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Clears display without deleting data
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={handleCleanupAllUserTempData}
                    disabled={cleaning}
                    variant="destructive"
                    className="w-full"
                    size="sm"
                  >
                    {cleaning ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {cleaning ? "Cleaning..." : "Delete All My Results"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Deletes ALL temporary results for your account
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
                  Waiting for agent to execute command
                </p>
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
                  {selectedQuery?.name} • {rows.length} rows • {headers.length} columns
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {headers.map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      {headers.map(h => (
                        <td key={h} className="px-4 py-2">
                          {typeof row[h] === 'object' 
                            ? JSON.stringify(row[h])
                            : String(row[h] ?? '')}
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