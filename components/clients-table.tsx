"use client"

import type { Client } from "@/types"
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
import { MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
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
import { getFirestore, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { AssignAgentDialog } from "./assign-agent-dialog"

interface ClientsTableProps {
  clients: Client[]
  onUpdate: () => void
}

export function ClientsTable({ clients, onUpdate }: ClientsTableProps) {
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assignAgentOpen, setAssignAgentOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const handleDelete = async () => {
    if (!selectedClient) return

    try {
      const db = getFirestore()
      const clientRef = doc(db, "clients", selectedClient.id)
      await deleteDoc(clientRef)

      toast({
        title: "Client deleted",
        description: `Client ${selectedClient.name} has been deleted.`,
      })
      onUpdate()
    } catch (error: any) {
      console.error("[v0] Delete client error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      })
    }

    setDeleteDialogOpen(false)
    setSelectedClient(null)
  }

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === "active" ? "disabled" : "active"

    try {
      const db = getFirestore()
      const clientRef = doc(db, "clients", client.id)
      await updateDoc(clientRef, { status: newStatus })

      toast({
        title: "Status updated",
        description: `Client ${client.name} is now ${newStatus}.`,
      })
      onUpdate()
    } catch (error: any) {
      console.error("[v0] Update status error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      })
    }
  }

  if (clients.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold">No clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new client.</p>
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
              <TableHead>Client Name</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned Agent</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{client.id}</TableCell>
                <TableCell>
                  <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge>
                </TableCell>
                <TableCell>
                  {client.agentUid ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{client.agentUid}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client)
                          setAssignAgentOpen(true)
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client)
                        setAssignAgentOpen(true)
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign Agent
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.lastSeen ? new Date(client.lastSeen).toLocaleDateString() : "Never"}
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
                      <DropdownMenuItem onClick={() => handleToggleStatus(client)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {client.status === "active" ? "Disable" : "Enable"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedClient(client)
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

      {selectedClient && (
        <AssignAgentDialog
          open={assignAgentOpen}
          onOpenChange={setAssignAgentOpen}
          client={selectedClient}
          onSuccess={onUpdate}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client {selectedClient?.name}. This action cannot be undone.
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
