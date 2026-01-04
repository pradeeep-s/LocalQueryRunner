"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, User } from "lucide-react"
import { auth } from "@/lib/firebase-client"
import { useEffect, useState } from "react"

interface AdminHeaderProps {
  userEmail: string
}

export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const [userRole, setUserRole] = useState<string>("Admin")

  useEffect(() => {
    const getCurrentRole = async () => {
      const user = auth.currentUser
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        const role = idTokenResult.claims.role as string
        setUserRole(role === "engineer" ? "Engineer" : "Admin")
      }
    }
    getCurrentRole()
  }, [])

  const handleLogout = async () => {
    try {
      await auth.signOut()
      document.cookie = "auth-token=; path=/; max-age=0"
      window.location.href = "/login"
    } catch (error) {
      console.error("[v0] Logout error:", error)
    }
  }

  const initials = userEmail
    .split("@")[0]
    .split(".")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="fixed left-64 right-0 top-0 z-30 h-16 border-b border-border bg-background">
      <div className="flex h-full items-center justify-end px-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userRole}</p>
                <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
