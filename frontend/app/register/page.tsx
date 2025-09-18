"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = useCallback(async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      localStorage.setItem("token", data.access_token)
      router.push("/dashboard")
    } catch (e: any) {
      setError(e.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }, [email, password, router])

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

      {/* Top bar */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/images/ayusetu_logo.png" alt="AYUSetu Logo" width={140} height={56} priority />
        </Link>
        <Button asChild className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 text-black hover:opacity-90">
          <Link href="/login">Sign in</Link>
        </Button>
      </nav>

      {/* Centered auth card */}
      <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-white/60">Join AYUSetu and start exploring</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm text-white/80">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/50 focus:border-cyan-400/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm text-white/80">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit()
                  }}
                  className="border-white/10 bg-white/5 pl-9 pr-10 text-white placeholder:text-white/50 focus:border-cyan-400/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-3 flex items-center text-white/70 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-center text-sm text-red-400">{error}</p>}

            <Button
              className="mt-2 w-full rounded-lg bg-gradient-to-r from-yellow-300 to-yellow-500 text-black hover:opacity-90"
              onClick={submit}
              disabled={loading || !email || !password}
            >
              {loading ? "Creating..." : "Create account"}
            </Button>

            <p className="pt-2 text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link href="/login" className="text-cyan-300 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}