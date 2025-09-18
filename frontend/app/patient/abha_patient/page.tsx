"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import Image from "next/image"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CreditCard } from "lucide-react"

// Format ABHA as 91-2542-1310-7033 while typing
const formatAbha = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 14)
  const parts = [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10), digits.slice(10, 14)].filter(Boolean)
  return parts.join("-")
}

export default function AbhaPatient() {
  const router = useRouter()
  const [abhaId, setAbhaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abhaDigits = abhaId.replace(/\D/g, "")
  const isValidAbha = abhaDigits.length === 14

  const submitLogin = useCallback(async () => {
    const digits = abhaId.replace(/\D/g, "")
    if (digits.length !== 14) {
      setError("Please enter a valid 14-digit ABHA number.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/auth/abha-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abha_id: abhaId.replace(/\D/g, "").trim(), mode: "patient" }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (typeof window !== "undefined") localStorage.setItem("token", data.access_token)
      router.push("/patient")
    } catch (e: any) {
      setError(e?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }, [abhaId, router])

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f19] via-[#0b0f19] to-black text-white">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-40"
          aria-hidden
        />
      </div>

      <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 md:grid-cols-2">
        {/* Illustration */}
        <div className="flex items-center justify-center">
          <Image src="/images/Patient.png" alt="Patient" width={420} height={520} className="h-auto w-[70%] max-w-[380px] object-contain" priority />
        </div>

        {/* Card */}
        <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Patient ABHA Login</h1>
            <p className="text-sm text-white/60">Enter your 14-digit ABHA number to continue</p>
          </div>

          {!isValidAbha && abhaId.length > 0 && (
            <p className="mt-3 text-sm text-red-400">Enter a valid 14-digit ABHA number (e.g., 12-3456-7890-1234).</p>
          )}

          <div className="mt-5 space-y-3">
            <label htmlFor="abha" className="text-sm text-white/80">
              ABHA Number
            </label>
            <div className="relative">
              <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <Input
                id="abha"
                type="text"
                inputMode="numeric"
                maxLength={17}
                placeholder="12-3456-7890-1234"
                value={abhaId}
                onChange={(e) => setAbhaId(formatAbha(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitLogin()
                }}
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/50 focus:border-cyan-400/40"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              className="mt-2 w-full rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-black hover:opacity-90"
              onClick={submitLogin}
              disabled={!isValidAbha || loading}
            >
              {loading ? "Please wait..." : "Enter"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}