"use client"

import type React from "react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase-client"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

interface CreateQueryDialogProps {
  onSuccess?: () => void
}

export function CreateQueryDialog({ onSuccess }: CreateQueryDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [sql, setSql] = useState("")
  const [variables, setVariables] = useState<string[]>([])
  const [currentVariable, setCurrentVariable] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const addVariable = () => {
    if (currentVariable && !variables.includes(currentVariable)) {
      setVariables([...variables, currentVariable])
      setCurrentVariable("")
    }
  }

  const removeVariable = (variable: string) => {
    setVariables(variables.filter((v) => v !== variable))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await addDoc(collection(db, "queries"), {
        name,
        sql,
        variables,
        createdAt: serverTimestamp(),
      })

      toast({
        title: "Query created",
        description: `Query "${name}" has been created successfully.`,
      })
      setOpen(false)
      // Reset form
      setName("")
      setSql("")
      setVariables([])

      if (onSuccess) onSuccess()
    } catch (error) {
      console.error("[v0] Error creating query:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create query",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Query
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Query</DialogTitle>
          <DialogDescription>
            Define a predefined SQL query with optional variables. Users cannot execute arbitrary SQL.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Query Name</Label>
              <Input
                id="name"
                placeholder="e.g., Get Orders By Date Range"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sql">SQL Query</Label>
              <Textarea
                id="sql"
                placeholder="SELECT * FROM orders WHERE date BETWEEN :fromDate AND :toDate"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                required
                disabled={loading}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use :variableName syntax for parameters (e.g., :fromDate, :toDate)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Variables</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., fromDate"
                  value={currentVariable}
                  onChange={(e) => setCurrentVariable(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addVariable()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addVariable} disabled={loading || !currentVariable}>
                  Add
                </Button>
              </div>
              {variables.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {variables.map((variable) => (
                    <Badge key={variable} variant="secondary" className="gap-1">
                      {variable}
                      <button
                        type="button"
                        onClick={() => removeVariable(variable)}
                        className="ml-1 rounded-sm hover:bg-secondary-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Query"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
