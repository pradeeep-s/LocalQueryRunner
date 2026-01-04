"use client"

import type { DatabaseConfig, Client } from "@/types"
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
import { MoreHorizontal, Trash2, EyeOff } from "lucide-react"
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
import { db } from "@/lib/firebase-client"
import { doc, deleteDoc } from "firebase/firestore"

interface DbConfigsTableProps {
  configs: DatabaseConfig[]
  clients: Client[]
  onDelete?: () => void
}

export function DbConfigsTable({ configs, clients, onDelete }: DbConfigsTableProps) {
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<DatabaseConfig | null>(null)

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    return client ? client.name : clientId
  }

  const handleDelete = async () => {
    if (!selectedConfig) return

    try {
      await deleteDoc(doc(db, "db_configs", selectedConfig.clientId))

      toast({
        title: "Configuration deleted",
        description: `Database credentials for ${getClientName(selectedConfig.clientId)} have been deleted.`,
      })

      if (onDelete) onDelete()
    } catch (error) {
      console.error("[v0] Error deleting config:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete configuration",
        variant: "destructive",
      })
    }

    setDeleteDialogOpen(false)
    setSelectedConfig(null)
  }

  if (configs.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold">No database credentials</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add database credentials to enable query execution.</p>
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
              <TableHead>Client</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Database</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((config) => (
              <TableRow key={config.clientId}>
                <TableCell className="font-medium">{getClientName(config.clientId)}</TableCell>
                <TableCell className="font-mono text-sm">{config.host}</TableCell>
                <TableCell>{config.port}</TableCell>
                <TableCell className="font-mono text-sm">{config.database}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500">
                    <EyeOff className="mr-1 h-3 w-3" />
                    Encrypted
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(config.updatedAt).toLocaleDateString()}
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
                          setSelectedConfig(config)
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the database credentials for{" "}
              {selectedConfig && getClientName(selectedConfig.clientId)}. This action cannot be undone.
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
