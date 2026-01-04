"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getFirestore, doc, updateDoc } from "firebase/firestore"
import type { Client } from "@/types"

interface EditClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  onSuccess: () => void
}

export function EditClientDialog({ open, onOpenChange, client, onSuccess }: EditClientDialogProps) {
  const [name, setName] = useState("")
  const [status, setStatus] = useState<"active" | "disabled">("active")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // <CHANGE> Pre-fill form when client changes
  useEffect(() => {
    if (client) {
      setName(client.name)
      setStatus(client.status)
    }
  }, [client])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    console.log("[v0] Updating client:", { id: client.id, name, status })

    try {
      const db = getFirestore()
      const clientRef = doc(db, "clients", client.id)

      await updateDoc(clientRef, {
        name,
        status,
      })

      console.log("[v0] Client updated successfully:", client.id)

      toast({
        title: "Client updated",
        description: `Client ${name} has been updated successfully.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      console.error("[v0] Update client error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update client",
        variant: "destructive",
      })
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update the client information. Client ID cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Client Name</Label>
              <Input
                id="edit-name"
                placeholder="Enter client name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value: "active" | "disabled") => setStatus(value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input value={client.id} disabled className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Client ID cannot be modified</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
