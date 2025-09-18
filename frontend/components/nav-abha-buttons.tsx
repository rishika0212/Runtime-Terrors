"use client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { apiPost } from "@/lib/api"

export function NavAbhaButtons() {
  const router = useRouter()
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("token")
  if (!hasToken) return null

  const doAbha = async (mode: "doctor" | "patient") => {
    const abhaId = typeof window !== "undefined" ? window.prompt(`Enter ABHA ID for ${mode}:`) : null
    if (!abhaId) return
    try {
      const res = await apiPost<{ access_token: string; token_type: string }>("/auth/abha-login", { abha_id: abhaId, mode })
      localStorage.setItem("token", res.access_token)
      router.push(mode === "doctor" ? "/doctor" : "/patient")
    } catch (e: any) {
      alert(e.message || "ABHA login failed")
    }
  }

  return (
    <div className="hidden md:flex items-center space-x-2">
      <Button className="rounded-xl" onClick={() => doAbha("doctor")}>Doctor A-B-H-A</Button>
      <Button variant="secondary" className="rounded-xl" onClick={() => doAbha("patient")}>Patient A-B-H-A</Button>
    </div>
  )
}