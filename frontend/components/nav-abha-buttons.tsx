"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { apiPost } from "@/lib/api"
import { Loader2 } from "lucide-react"

export function NavAbhaButtons() {
  const router = useRouter()
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("token")
  const [loading, setLoading] = useState<null | "doctor" | "patient">(null)
  if (!hasToken) return null

  const doAbha = async (mode: "doctor" | "patient") => {
    const abhaId = typeof window !== "undefined" ? window.prompt(`Enter ABHA ID for ${mode}:`) : null
    if (!abhaId) return
    try {
      setLoading(mode)
      const digitsOnly = abhaId.replace(/\D/g, "").trim()
      const res = await apiPost<{ access_token: string; token_type: string }>("/auth/abha-login", { abha_id: digitsOnly, mode })
      localStorage.setItem("token", res.access_token)
      if (mode === "patient") {
        // Persist patient ABHA so patient dashboard uses the correct ID
        localStorage.setItem("abha_id", digitsOnly)
      }
      router.push(mode === "doctor" ? "/doctor" : "/patient")
    } catch (e: any) {
      alert(e.message || "ABHA login failed")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="hidden md:flex items-center space-x-2">
      <Button className="rounded-xl" onClick={() => doAbha("doctor")} disabled={loading === "doctor"}>
        {loading === "doctor" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Doctor A-B-H-A</>) : "Doctor A-B-H-A"}
      </Button>
      <Button variant="secondary" className="rounded-xl" onClick={() => doAbha("patient")} disabled={loading === "patient"}>
        {loading === "patient" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Patient A-B-H-A</>) : "Patient A-B-H-A"}
      </Button>
    </div>
  )
}