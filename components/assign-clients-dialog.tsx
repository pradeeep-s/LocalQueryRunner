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
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { getFirestore, doc, updateDoc } from "firebase/firestore"
import type { Client, Engineer } from "@/types"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AssignClientsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  engineer: Engineer
  clients: Client[]
  onSuccess: () => void
}

export function AssignClientsDialog({ open, onOpenChange, engineer, clients, onSuccess }: AssignClientsDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])

  useEffect(() => {
    if (open && engineer) {
      setSelectedClientIds(engineer.assignedClients || [])
    }
  }, [open, engineer])

  const handleToggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    )
  }

  const handleSelectAll = () => {
    if (selectedClientIds.length === clients.length) {
      setSelectedClientIds([])
    } else {
      setSelectedClientIds(clients.map((c) => c.id))
    }
  }

  const handleSave = async () => {
    setLoading(true)

    try {
      const db = getFirestore()
      const engineerRef = doc(db, "users", engineer.uid)

      await updateDoc(engineerRef, {
        assignedClients: selectedClientIds,
      })

      toast({
        title: "Clients assigned",
        description: `${selectedClientIds.length} client(s) assigned to ${engineer.email}`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("[v0] Assign clients error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to assign clients",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Clients to Engineer</DialogTitle>
          <DialogDescription>Select which clients {engineer.email} can access</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Available Clients ({clients.length})</Label>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedClientIds.length === clients.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <ScrollArea className="h-[400px] rounded-lg border p-4">
            <div className="space-y-3">
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients available. Create clients first.</p>
              ) : (
                clients.map((client) => (
                  <div key={client.id} className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50">
                    <Checkbox
                      id={`client-${client.id}`}
                      checked={selectedClientIds.includes(client.id)}
                      onCheckedChange={() => handleToggleClient(client.id)}
                    />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor={`client-${client.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {client.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">ID: {client.id}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm">
              <span className="font-semibold">{selectedClientIds.length}</span> of{" "}
              <span className="font-semibold">{clients.length}</span> clients selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Assignments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
