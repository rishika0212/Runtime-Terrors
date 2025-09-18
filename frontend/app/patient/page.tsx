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

  // Mock data for demonstration
  useEffect(() => {
    const mockHistory: HistoryEntry[] = [
      {
        doctor_name: "Rajesh Sharma",
        doctor_abha_id: "AYU-12345",
        diagnosis: "Vata Dosha Imbalance (Ayurvedic: Vātavyādhi) - Mapped to ICD-11: Disorders of the musculoskeletal system (FB00-FB9Z)",
        date: "2024-01-15",
        clinic: "Ayurvedic Wellness Center",
        notes: "Patient presented with joint pain and stiffness. Recommended Panchakarma therapy and herbal remedies."
      },
      {
        doctor_name: "Dr. Priya Patel",
        doctor_abha_id: "DOC-67890",
        diagnosis: "Rheumatoid Arthritis (ICD-11: FA20) - Allopathic treatment prescribed",
        date: "2024-02-20",
        clinic: "Modern Medical Clinic",
        notes: "Follow-up visit showing improvement. Continue medication regimen and physical therapy."
      },
      {
        doctor_name: "Vaidya Mohan Kumar",
        doctor_abha_id: "AYU-54321",
        diagnosis: "Pitta Dosha Aggravation (Ayurvedic: Pittavikāra) - Mapped to ICD-11: Certain infectious and parasitic diseases (1A00-1H0Z)",
        date: "2024-03-10",
        clinic: "Traditional Medicine Institute",
        notes: "Patient with fever and digestive issues. Prescribed cooling herbs and dietary modifications."
      }
    ]
    setHistory(mockHistory)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/")
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
    <div className="relative min-h-screen bg-gradient-to-b from-[#0b0f19] via-[#0b0f19] to-black text-white">
      {/* Subtle grid + glow accents (match landing) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[-10%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-80 w-80 rounded-full bg-yellow-500/10 blur-3xl" />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30"
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
            <p className="text-xs text-white/60">Your records at a glance</p>
          </div>
        </div>

        <Button
          onClick={handleLogout}
          className="rounded-full bg-gradient-to-r from-red-500 to-pink-600 px-6 text-white hover:opacity-90"
        >
          Logout
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-6">
        {/* Welcome / Summary */}
        <Card className="border-white/10 bg-white/5 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="text-xl">Welcome back</span>
              <Badge className="bg-gradient-to-r from-yellow-300 to-yellow-500 text-black">Secure</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70">
            View and manage your medical history. Use search and sorting to quickly find past visits.
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr]">
          {/* History Panel */}
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-lg font-semibold">Medical History</span>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <div className="relative sm:w-64">
                    <Input
                      placeholder="Search by doctor, diagnosis, clinic..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border-white/10 bg-white/10 text-white placeholder:text-white/50"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-full border-white/10 bg-white/10 text-white sm:w-40">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0b0f19] text-white">
                      <SelectItem value="recent">Most recent</SelectItem>
                      <SelectItem value="doctor">Doctor name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
            </CardHeader>

            <Separator className="bg-white/10" />

            <CardContent className="pt-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <Image
                    src="/placeholder.svg"
                    alt="Empty"
                    width={120}
                    height={120}
                    className="opacity-70"
                  />
                  <p className="text-white/70">No history available.</p>
                  <p className="text-sm text-white/50">Records from your consultations will appear here.</p>
                </div>
              ) : (
                <ScrollArea className="h-[520px] pr-3">
                  <div className="space-y-4">
                    {filtered.map((entry, idx) => (
                      <div
                        key={idx}
                        className="group rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-white/20">
                              <AvatarFallback className="bg-gradient-to-br from-yellow-300 to-cyan-400 text-black">
                                {initials(entry.doctor_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">Dr. {entry.doctor_name}</p>
                                <Badge variant="secondary" className="border-white/10 bg-white/10 text-white">
                                  ABHA: {entry.doctor_abha_id}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-white/60">
                                {entry.clinic ?? "Clinic"} • {entry.date ? new Date(entry.date).toLocaleDateString() : "Date N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20"
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
                          <p className="text-sm text-white/80"><span className="text-white/60">Diagnosis:</span> {entry.diagnosis}</p>
                          {entry.notes && (
                            <p className="mt-1 text-sm text-white/60">{entry.notes}</p>
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
