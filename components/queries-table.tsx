"use client"

import { Label } from "@/components/ui/label"

import type { Query } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash2, Code } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { db } from "@/lib/firebase-client"
import { doc, deleteDoc } from "firebase/firestore"

interface QueriesTableProps {
  queries: Query[]
  onDelete?: () => void
}

export function QueriesTable({ queries, onDelete }: QueriesTableProps) {
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null)

  const handleDelete = async () => {
    if (!selectedQuery) return

    try {
      await deleteDoc(doc(db, "queries", selectedQuery.id))

      toast({
        title: "Query deleted",
        description: `Query "${selectedQuery.name}" has been deleted.`,
      })

      if (onDelete) onDelete()
    } catch (error) {
      console.error("[v0] Error deleting query:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete query",
        variant: "destructive",
      })
    }

    setDeleteDialogOpen(false)
    setSelectedQuery(null)
  }

  if (queries.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold">No queries</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create predefined queries for execution.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Query Name</TableHead>
              <TableHead>Query ID</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queries.map((query) => (
              <TableRow key={query.id}>
                <TableCell className="font-medium">{query.name}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{query.id}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {query.variables.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      query.variables.map((variable) => (
                        <Badge key={variable} variant="outline">
                          {variable}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(query.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedQuery(query)
                          setViewDialogOpen(true)
                        }}
                      >
                        <Code className="mr-2 h-4 w-4" />
                        View SQL
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedQuery(query)
                          setDeleteDialogOpen(true)
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedQuery?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">SQL Query</Label>
              <pre className="mt-2 rounded-lg border bg-muted p-4 text-sm font-mono overflow-x-auto">
                {selectedQuery?.sql}
              </pre>
            </div>
            {selectedQuery && selectedQuery.variables.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Variables</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedQuery.variables.map((variable) => (
                    <Badge key={variable} variant="secondary">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the query "{selectedQuery?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
