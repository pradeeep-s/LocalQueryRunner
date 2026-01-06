"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase-client"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>("")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("[v0] Auth state changed:", user?.email)

      if (!user) {
        console.log("[v0] No user, redirecting to login")
        window.location.href = "/login"
        return
      }

      try {
        // Get token without forcing refresh
        const idTokenResult = await user.getIdTokenResult()
        console.log("[v0] Token claims:", idTokenResult.claims)

        const userRole = idTokenResult.claims.role as string
        if (userRole !== "admin" && userRole !== "engineer" && userRole !== "agent") {
          console.log("[v0] User does not have admin, engineer, or agent role")
          window.location.href = "/login"
          return
        }

        setUserEmail(user.email || "")
        setLoading(false)
      } catch (error) {
        console.error("[v0] Error getting token:", error)
        window.location.href = "/login"
      }
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-neutral-400">Verifying credentials...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <AdminSidebar />
      <AdminHeader userEmail={userEmail} />
      <main className="ml-64 mt-16 p-6">{children}</main>
    </div>
  )
}
