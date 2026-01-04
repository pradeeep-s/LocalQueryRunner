"use client"

import type { Agent, Client } from "@/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface AgentsTableProps {
  agents: Agent[]
  clients: Client[]
  onUpdate: () => void
}

export function AgentsTable({ agents, clients }: AgentsTableProps) {
  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    return client ? client.name : clientId
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h3 className="mt-2 text-sm font-semibold">No agents</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create agents manually in Firebase Console.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.uid}>
              <TableCell className="font-mono text-sm">{agent.email}</TableCell>
              <TableCell className="font-medium">{getClientName(agent.clientId)}</TableCell>
              <TableCell>
                <Badge variant="outline">{agent.role}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{new Date(agent.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-muted-foreground">
                {agent.lastLogin ? new Date(agent.lastLogin).toLocaleDateString() : "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
