"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { apiGet } from "@/lib/api"
import { Loader2 } from "lucide-react"

interface HistoryEntry {
  doctor_name: string
  doctor_abha_id: string
  diagnosis: string
  date?: string // ISO date string
  clinic?: string
  notes?: string
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("")
}

export default function PatientPage() {
  const router = useRouter()

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "doctor">("recent")
  const [loading, setLoading] = useState(true)
  const [patientName, setPatientName] = useState<string>("")

  // Load patient name from localStorage
  useEffect(() => {
    const name = typeof window !== "undefined" ? localStorage.getItem("name") || "" : ""
    setPatientName(name)
  }, [])

  // Load from API
  useEffect(() => {
    let canceled = false
    ;(async () => {
      if (!canceled) setLoading(true)
      try {
        const abha = typeof window !== "undefined" ? (localStorage.getItem("abha_id") || "") : ""
        if (!abha) throw new Error("Missing ABHA ID. Please login again.")
        const bundle = await apiGet<any>(`/fhir/Condition?patient=Patient/${abha}&count=50&offset=0`)
        const mapped: HistoryEntry[] = (bundle.entry || []).map((e: any) => {
          const cond = e.resource || {}
          const coding = (cond.code?.coding || []) as Array<{ system?: string; code?: string }>
          const sys = (s?: string) => (s || "").toLowerCase()
          const nm = coding.find(c => sys(c.system).includes("namaste"))
          const tm2 = coding.find(c => sys(c.system).includes("/11/26") || sys(c.system).includes("traditional medicine module") || c.system === "ICD11_TM2")
          const mms = coding.find(c => sys(c.system).includes("/11/mms") || sys(c.system).includes("mms") || sys(c.system).includes("biomedicine") || c.system === "ICD11_MMS")
          const asserter = cond.asserter || {}
          let doctor_name = asserter.display || "Unknown"
          let doctor_abha_id = "N/A"
          if (asserter.reference) {
            const ref = asserter.reference
            if (ref.startsWith("Practitioner/")) {
              doctor_abha_id = ref.split("/")[1]
            }
          }
          return {
            doctor_name,
            doctor_abha_id,
            diagnosis: [
              cond.code?.text,
              nm ? `NAMASTE: ${nm.code}` : null,
              tm2 ? `ICD11 TM2: ${tm2.code}` : null,
              mms ? `ICD11 MMS: ${mms.code}` : null,
            ].filter(Boolean).join(" • "),
            date: cond.meta?.lastUpdated ? new Date(cond.meta.lastUpdated).toISOString() : undefined,
            clinic: undefined,
            notes: undefined,
          }
        })
        if (!canceled) setHistory(mapped)
      } catch (err) {
        console.error(err)
        if (!canceled) setHistory([])
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("abha_id")
    localStorage.removeItem("name")
    router.push("/dashboard")
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let data = [...history]

    if (q) {
      data = data.filter((h) =>
        [
          h.doctor_name,
          h.doctor_abha_id,
          h.diagnosis,
          h.clinic ?? "",
          h.notes ?? "",
          h.date ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    }

    if (sortBy === "recent") {
      data.sort((a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
      )
    } else if (sortBy === "doctor") {
      data.sort((a, b) => a.doctor_name.localeCompare(b.doctor_name))
    }

    return data
  }, [history, search, sortBy])

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Subtle grid + glow accents (match landing) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[-10%] h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30"
          aria-hidden
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/images/ayusetu_logo.png"
            alt="AYUSetu Logo"
            width={72}
            height={72}
            className="h-12 w-12 rounded-full object-contain"
          />
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-cyan-400 bg-clip-text text-transparent">
                Patient Dashboard
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Your records at a glance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleLogout}
            className="rounded-full bg-primary px-6 text-primary-foreground hover:opacity-90 shadow-sm"
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-6">
        {/* Welcome / Summary */}
        <Card className="border border-border bg-card backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="text-xl">
                Welcome back{patientName ? `, ${patientName}` : ""}
              </span>
              <Badge className="bg-secondary text-secondary-foreground">Secure</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            View and manage your medical history. Use search and sorting to quickly find past visits.
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr]">
          {/* History Panel */}
          <Card className="border border-border bg-card backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-lg font-semibold">Medical History</span>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <div className="relative sm:w-64">
                    <Input
                      placeholder="Search by doctor, diagnosis, clinic..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border-border bg-input text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-full border-border bg-card text-foreground sm:w-40">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-foreground">
                      <SelectItem value="recent">Most recent</SelectItem>
                      <SelectItem value="doctor">Doctor name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
            </CardHeader>

            <Separator className="bg-border" />

            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center py-14 text-white/70">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading history...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <Image
                    src="/placeholder.svg"
                    alt="Empty"
                    width={120}
                    height={120}
                    className="opacity-70"
                  />
                  <p className="text-muted-foreground">No history available.</p>
                  <p className="text-sm text-muted-foreground/80">Records from your consultations will appear here.</p>
                </div>
              ) : (
                <ScrollArea className="h-[520px] pr-3">
                  <div className="space-y-4">
                    {filtered.map((entry, idx) => (
                      <div
                        key={idx}
                        className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-border/60">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {initials(entry.doctor_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">Dr. {entry.doctor_name}</p>
                                <Badge variant="secondary" className="bg-secondary/15 text-foreground">
                                  ABHA: {entry.doctor_abha_id}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {entry.clinic ?? "Clinic"} • {entry.date ? new Date(entry.date).toLocaleDateString() : "Date N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="rounded-full border-border bg-secondary/20 text-foreground hover:bg-secondary/30"
                              onClick={() => alert("Details coming soon")}
                            >
                              View Details
                            </Button>
                            <Button
                              className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 text-black hover:opacity-90"
                              onClick={() => alert("Download coming soon")}
                            >
                              Download
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-sm text-foreground/90"><span className="text-muted-foreground">Diagnosis:</span> {entry.diagnosis}</p>
                          {entry.notes && (
                            <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
