"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Download, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Query } from "@/types"
import { db, auth } from "@/lib/firebase-client"
import { collection, getDocs, getDoc, doc, addDoc, serverTimestamp } from "firebase/firestore"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import "jspdf-autotable"

interface QueryResult {
  headers: string[]
  rows: any[][]
  timestamp: string
}

export default function AgentReportsPage() {
  const [queries, setQueries] = useState<Query[]>([])
  const [selectedQueryId, setSelectedQueryId] = useState("")
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [polling, setPolling] = useState(false)
  const [commandId, setCommandId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>("agent")
  const [agentClientId, setAgentClientId] = useState<string>("")
  const [agentUid, setAgentUid] = useState<string>("")

  const { toast } = useToast()

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      const user = auth.currentUser
      if (!user) return

      setAgentUid(user.uid)

      const token = await user.getIdTokenResult()
      const role = (token.claims.role as string) || "agent"
      setUserRole(role)

      // Get user document to retrieve clientId
      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (userDoc.exists()) {
        const clientId = userDoc.data().clientId
        setAgentClientId(clientId)
      }

      // Load all queries and filter based on agent assignment
      const queriesSnap = await getDocs(collection(db, "queries"))
      const allQueries = queriesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Query[]

      const filteredQueries = allQueries.filter((q) => {
        const assignedAgents = q.assignedAgents || []
        return assignedAgents.includes(user.uid)
      })

      setQueries(filteredQueries)
    } catch (err) {
      console.error("[AgentReports] init error:", err)
      toast({
        title: "Error",
        description: "Failed to load queries",
        variant: "destructive",
      })
    }
  }

  /* ================= HANDLE QUERY SELECTION ================= */
  const selectedQuery = queries.find((q) => q.id === selectedQueryId)

  useEffect(() => {
    if (!selectedQuery) return
    const vars: Record<string, string> = {}
    selectedQuery.variables.forEach((v) => (vars[v] = ""))
    setVariables(vars)
  }, [selectedQuery])

  /* ================= EXECUTE QUERY ================= */
  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agentClientId) {
      toast({
        title: "Error",
        description: "Agent client ID not found",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setResult(null)
    setCommandId(null)

    try {
      const payload: any = {
        clientId: agentClientId,
        queryId: selectedQueryId,
        variables: variables,
        status: "pending",
        createdAt: serverTimestamp(),
      }

      const ref = await addDoc(collection(db, "commands"), payload)
      setCommandId(ref.id)
      setPolling(true)

      toast({
        title: "Query submitted",
        description: "Generating report...",
      })
    } catch (err: any) {
      console.error("[AgentReports] error:", err)
      toast({
        title: "Error",
        description: err.message || "Query execution failed",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  /* ================= POLLING ================= */
  useEffect(() => {
    if (!polling || !commandId) return

    const interval = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, "commands", commandId))
        if (!snap.exists()) return

        const data = snap.data()

        if (data.status === "success") {
          setPolling(false)
          setLoading(false)

          // Parse result
          if (data.result) {
            const parsedResult: QueryResult = {
              headers: data.result.headers || [],
              rows: data.result.rows || [],
              timestamp: new Date().toLocaleString(),
            }
            setResult(parsedResult)
          }

          toast({
            title: "Success",
            description: "Report generated successfully",
          })
        } else if (data.status === "failed") {
          setPolling(false)
          setLoading(false)
          toast({
            title: "Error",
            description: data.error || "Query execution failed",
            variant: "destructive",
          })
        }
      } catch (err) {
        console.error("[AgentReports] polling error:", err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [polling, commandId])

  /* ================= EXPORT TO PDF ================= */
  const exportToPdf = () => {
    if (!result) return

    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()

    // Add title
    pdf.setFontSize(16)
    pdf.text("Report", 14, 15)

    // Add metadata
    pdf.setFontSize(10)
    pdf.text(`Query: ${selectedQuery?.name || "Custom"}`, 14, 25)
    pdf.text(`Generated: ${result.timestamp}`, 14, 32)

    // Add table
    const tableData = [result.headers, ...result.rows]
    ;(pdf as any).autoTable({
      head: [result.headers],
      body: result.rows,
      startY: 40,
      margin: { left: 14, right: 14 },
      didDrawPage: (data: any) => {
        const pageSize = pdf.internal.pageSize
        const pageHeight = pageSize.getHeight()
        const pageWidth = pageSize.getWidth()
        pdf.setFontSize(10)
        pdf.text(`Page ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: "center" })
      },
    })

    pdf.save(`report-${Date.now()}.pdf`)
  }

  /* ================= EXPORT TO EXCEL ================= */
  const exportToExcel = () => {
    if (!result) return

    const worksheet = XLSX.utils.aoa_to_sheet([result.headers, ...result.rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report")
    XLSX.writeFile(workbook, `report-${Date.now()}.xlsx`)
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate Custom Report</h1>
        <p className="text-muted-foreground">Select a query and variables to generate a report</p>
      </div>

      <form onSubmit={handleExecute} className="grid gap-6 lg:grid-cols-3">
        {/* FORM */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Select query and input variables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Query Name</Label>
              <Select value={selectedQueryId} onValueChange={setSelectedQueryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a query" />
                </SelectTrigger>
                <SelectContent>
                  {queries.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No queries available</div>
                  ) : (
                    queries.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedQuery && selectedQuery.variables.length > 0 && (
              <div className="space-y-3 border rounded p-4 bg-muted/50">
                <p className="text-sm font-medium">Query Variables</p>
                {selectedQuery.variables.map((v) => (
                  <div key={v}>
                    <Label className="text-sm">{v}</Label>
                    <Input
                      value={variables[v] ?? ""}
                      onChange={(e) =>
                        setVariables({
                          ...variables,
                          [v]: e.target.value,
                        })
                      }
                      placeholder={`Enter ${v}`}
                      required
                    />
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" disabled={loading || !selectedQueryId} className="w-full">
              {loading ? <Loader2 className="mr-2 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              {loading ? "Generating..." : "Generate Report"}
            </Button>
          </CardContent>
        </Card>

        {/* DOWNLOAD OPTIONS */}
        <Card>
          <CardHeader>
            <CardTitle>Export Options</CardTitle>
            <CardDescription>Download your report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Rows: {result.rows.length}</p>
                  <p>Columns: {result.headers.length}</p>
                </div>

                <Button onClick={exportToPdf} variant="outline" className="w-full bg-transparent">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>

                <Button onClick={exportToExcel} variant="outline" className="w-full bg-transparent">
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Run a query to see download options</p>
            )}
          </CardContent>
        </Card>
      </form>

      {/* RESULTS PREVIEW */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Report Preview</CardTitle>
            <CardDescription>Generated at {result.timestamp}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    {result.headers.map((header, i) => (
                      <th key={i} className="text-left py-2 px-4 font-semibold text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      {row.map((cell, j) => (
                        <td key={j} className="py-2 px-4">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 10 && (
                <p className="text-xs text-muted-foreground mt-4">
                  Showing 10 of {result.rows.length} rows (download to see all)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
