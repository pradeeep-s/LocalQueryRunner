"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getFirestore, doc, updateDoc, collection, getDocs } from "firebase/firestore"
import type { Client, Agent } from "@/types"

interface AssignAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  onSuccess: () => void
}

export function AssignAgentDialog({ open, onOpenChange, client, onSuccess }: AssignAgentDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentUid, setSelectedAgentUid] = useState<string>(client.agentUid || "")

  useEffect(() => {
    if (open) {
      fetchAgents()
    }
  }, [open])

  const fetchAgents = async () => {
    try {
      const db = getFirestore()
      const agentsSnapshot = await getDocs(collection(db, "users"))
      const agentsList: Agent[] = []

      agentsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.role === "agent") {
          agentsList.push({
            uid: doc.id,
            email: data.email,
            role: data.role,
            clientId: data.clientId,
            createdAt: data.createdAt,
            lastLogin: data.lastLogin,
          })
        }
      })

      setAgents(agentsList)
    } catch (error: any) {
      console.error("[v0] Fetch agents error:", error)
      toast({
        title: "Error",
        description: "Failed to load agents",
        variant: "destructive",
      })
    }
  }

  const handleAssign = async () => {
    if (!selectedAgentUid) {
      toast({
        title: "Error",
        description: "Please select an agent",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const db = getFirestore()
      const clientRef = doc(db, "clients", client.id)

      // Update client with agent assignment
      await updateDoc(clientRef, {
        agentUid: selectedAgentUid,
      })

      // Update agent with client assignment
      const agentRef = doc(db, "users", selectedAgentUid)
      await updateDoc(agentRef, {
        clientId: client.id,
      })

      toast({
        title: "Agent assigned",
        description: `Agent has been assigned to ${client.name}`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("[v0] Assign agent error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to assign agent",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUnassign = async () => {
    setLoading(true)

    try {
      const db = getFirestore()
      const clientRef = doc(db, "clients", client.id)

      // Remove agent from client
      await updateDoc(clientRef, {
        agentUid: null,
      })

      // If there was an agent assigned, remove client from agent
      if (client.agentUid) {
        const agentRef = doc(db, "users", client.agentUid)
        await updateDoc(agentRef, {
          clientId: null,
        })
      }

      toast({
        title: "Agent unassigned",
        description: `Agent has been unassigned from ${client.name}`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("[v0] Unassign agent error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to unassign agent",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Agent</DialogTitle>
          <DialogDescription>Assign an agent to {client.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agent">Select Agent</Label>
            <Select value={selectedAgentUid} onValueChange={setSelectedAgentUid}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter((agent) => !agent.clientId || agent.clientId === client.id)
                  .map((agent) => (
                    <SelectItem key={agent.uid} value={agent.uid}>
                      {agent.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {agents.length === 0 && (
              <p className="text-sm text-muted-foreground">No agents available. Create agents first.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {client.agentUid && (
            <Button variant="outline" onClick={handleUnassign} disabled={loading}>
              Unassign Current
            </Button>
          )}
          <Button onClick={handleAssign} disabled={loading || !selectedAgentUid}>
            {loading ? "Assigning..." : "Assign Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
