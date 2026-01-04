"use client"

import type { Engineer, Client } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"
import { useState } from "react"
import { AssignClientsDialog } from "./assign-clients-dialog"

interface EngineersTableProps {
  engineers: Engineer[]
  clients: Client[]
  onUpdate: () => void
}

function formatDate(dateValue: any): string {
  if (!dateValue) return "Never"

  try {
    if (dateValue && typeof dateValue === "object" && "toDate" in dateValue) {
      return dateValue.toDate().toLocaleDateString()
    }

    const date = new Date(dateValue)
    if (isNaN(date.getTime())) {
      return "Invalid Date"
    }

    return date.toLocaleDateString()
  } catch (error) {
    console.error("[v0] Date formatting error:", error)
    return "Invalid Date"
  }
}

export function EngineersTable({ engineers, clients, onUpdate }: EngineersTableProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null)

  const getAssignedClientsInfo = (engineer: Engineer) => {
    if (!engineer.assignedClients || engineer.assignedClients.length === 0) {
      return { count: 0, names: [] }
    }

    const assignedClientNames = clients
      .filter((client) => engineer.assignedClients.includes(client.id))
      .map((client) => client.name)

    return {
      count: engineer.assignedClients.length,
      names: assignedClientNames,
    }
  }

  if (engineers.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold">No engineers</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create engineer accounts in Firebase Console.</p>
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
              <TableHead>Email</TableHead>
              <TableHead>Assigned Clients</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engineers.map((engineer) => {
              const clientsInfo = getAssignedClientsInfo(engineer)
              return (
                <TableRow key={engineer.uid}>
                  <TableCell className="font-mono text-sm">{engineer.email}</TableCell>
                  <TableCell>
                    {clientsInfo.count > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{clientsInfo.count} clients</Badge>
                        {clientsInfo.names.slice(0, 2).map((name, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                        {clientsInfo.count > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{clientsInfo.count - 2} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No clients assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(engineer.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(engineer.lastLogin)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedEngineer(engineer)
                        setAssignDialogOpen(true)
                      }}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Assign Clients
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selectedEngineer && (
        <AssignClientsDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          engineer={selectedEngineer}
          clients={clients}
          onSuccess={onUpdate}
        />
      )}
    </>
  )
}
