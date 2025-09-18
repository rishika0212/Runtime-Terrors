"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { API_URL, apiGet } from "@/lib/api"

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

import {
  Home,
  Users,
  PlusCircle,
  Link as LinkIcon,
  Search,
  LogOut,
  Activity,
  ClipboardList,
  RefreshCw,
} from "lucide-react"

// Types aligned with API
 type ConceptMapItem = {
  source_system: string
  source_code: string
  target_system: string
  target_code: string
  mapping_type: string
  confidence?: number | null
  source_display?: string | null
  target_display?: string | null
}

 type Patient = {
  id: number
  patient_name: string
  age?: number | null
  sex?: string | null
  diagnosis?: string | null
  icd_system?: string | null
  icd_code?: string | null
}

export default function DoctorDashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Auth + patient list
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [patientsError, setPatientsError] = useState<string | null>(null)
  const [patientQuery, setPatientQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientSheetOpen, setPatientSheetOpen] = useState(false)
  // Explicit sidebar control so the toggle button always works
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Global search + limit
  const [searchText, setSearchText] = useState("")
  const [limit, setLimit] = useState(10)
  const [activeTab, setActiveTab] = useState<"all" | "ayurveda" | "siddha" | "unani">("all")
  const [activeView, setActiveView] = useState<"mappings" | "patients">("mappings")

  // Per-system pagination + data
  const [pageAyur, setPageAyur] = useState(1)
  const [pageSiddha, setPageSiddha] = useState(1)
  const [pageUnani, setPageUnani] = useState(1)
  const [pageAll, setPageAll] = useState(1)

  const [mapsAyur, setMapsAyur] = useState<ConceptMapItem[]>([])
  const [mapsSiddha, setMapsSiddha] = useState<ConceptMapItem[]>([])
  const [mapsUnani, setMapsUnani] = useState<ConceptMapItem[]>([])
  const [mapsAll, setMapsAll] = useState<ConceptMapItem[]>([])

  const [countAyur, setCountAyur] = useState(0)
  const [countSiddha, setCountSiddha] = useState(0)
  const [countUnani, setCountUnani] = useState(0)
  const [countAll, setCountAll] = useState(0)

  const [loadingAyur, setLoadingAyur] = useState(false)
  const [loadingSiddha, setLoadingSiddha] = useState(false)
  const [loadingUnani, setLoadingUnani] = useState(false)

  // Add mapping dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addSystem, setAddSystem] = useState("ayurveda")
  const [addSourceCode, setAddSourceCode] = useState("")
  const [addSourceDisplay, setAddSourceDisplay] = useState("")
  const [addTargetSystem, setAddTargetSystem] = useState("ICD-11 TM2")
  const [addTargetCode, setAddTargetCode] = useState("")
  const [addNotes, setAddNotes] = useState("")

  // Check token and load patients
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    const load = async () => {
      const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null
      setToken(tok)
      if (!tok) {
        router.push("/doctor/abha_doctor")
        return
      }
      try {
        setPatientsLoading(true)
        setPatientsError(null)
        const res = await fetch(`${API_URL}/patient-forms?mine_only=true&limit=100`, {
          headers: { Authorization: `Bearer ${tok}` },
          cache: "no-store",
        })
        if (!res.ok) throw new Error(await res.text())
        const data: Patient[] = await res.json()
        setPatients(data)
      } catch (e: any) {
        setPatientsError(e?.message || "Failed to load patients")
        setPatients([])
      } finally {
        setPatientsLoading(false)
      }
    }
    load()
  }, [router])

  // Set active view based on URL param
  useEffect(() => {
    const view = searchParams.get("view")
    if (view === "patients") {
      setActiveView("patients")
    }
  }, [searchParams])

  // Fetch per-system
  const fetchSystem = useCallback(
    async (system: "ayurveda" | "siddha" | "unani", page: number) => {
      const path = searchText
        ? `/conceptmaps?system=${system}&search=${encodeURIComponent(searchText)}&limit=${limit}&offset=${(page - 1) * limit}`
        : `/conceptmaps?system=${system}&limit=${limit}&offset=${(page - 1) * limit}`
      return apiGet<{ count: number; items: ConceptMapItem[] }>(path, token || undefined)
    },
    [searchText, limit, token]
  )

  // Fetch unified (all systems)
  const fetchAll = useCallback(
    async (page: number) => {
      const path = searchText
        ? `/conceptmaps?system=all&search=${encodeURIComponent(searchText)}&limit=${limit}&offset=${(page - 1) * limit}`
        : `/conceptmaps?system=all&limit=${limit}&offset=${(page - 1) * limit}`
      return apiGet<{ count: number; items: ConceptMapItem[] }>(path, token || undefined)
    },
    [searchText, limit, token]
  )

  const refreshAll = useCallback(async () => {
    setLoadingAyur(true)
    setLoadingSiddha(true)
    setLoadingUnani(true)
    try {
      const [a, s, u, all] = await Promise.all([
        fetchSystem("ayurveda", pageAyur),
        fetchSystem("siddha", pageSiddha),
        fetchSystem("unani", pageUnani),
        fetchAll(pageAll),
      ])
      setMapsAyur(a.items || [])
      setCountAyur(a.count || 0)
      setMapsSiddha(s.items || [])
      setCountSiddha(s.count || 0)
      setMapsUnani(u.items || [])
      setCountUnani(u.count || 0)
      setMapsAll(all.items || [])
      setCountAll(all.count || 0)
    } catch (e) {
      setMapsAyur([])
      setCountAyur(0)
      setMapsSiddha([])
      setCountSiddha(0)
      setMapsUnani([])
      setCountUnani(0)
      setMapsAll([])
      setCountAll(0)
    } finally {
      setLoadingAyur(false)
      setLoadingSiddha(false)
      setLoadingUnani(false)
    }
  }, [fetchSystem, fetchAll, pageAyur, pageSiddha, pageUnani, pageAll])

  // Debounce search and limit
  useEffect(() => {
    const id = setTimeout(() => {
      setPageAyur(1)
      setPageSiddha(1)
      setPageUnani(1)
      setPageAll(1)
      refreshAll()
    }, 350)
    return () => clearTimeout(id)
  }, [searchText, limit, refreshAll])

  // Refresh when any page changes
  useEffect(() => {
    refreshAll()
  }, [pageAyur, pageSiddha, pageUnani, refreshAll])

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase()
    if (!q) return patients
    return patients.filter((p) => (p.patient_name || "").toLowerCase().includes(q) || String(p.id).includes(q))
  }, [patients, patientQuery])

  const openPatient = (p: Patient) => {
    setSelectedPatient(p)
    setPatientSheetOpen(true)
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
    }
    router.push("/")
  }

  const submitNewMapping = (e: React.FormEvent) => {
    e.preventDefault()
    setAddOpen(false)
    console.warn("Mapping suggestion:", {
      addSystem,
      addSourceCode,
      addSourceDisplay,
      addTargetSystem,
      addTargetCode,
      addNotes,
    })
    toast({
      title: "Suggestion submitted",
      description: "Your mapping suggestion has been recorded (client-side). Please wire a backend endpoint to persist.",
    })
    setAddSourceCode("")
    setAddSourceDisplay("")
    setAddTargetCode("")
    setAddNotes("")
  }

  const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

  const copyToClipboard = useCallback((text: string) => {
    if (!text) return
    navigator.clipboard?.writeText(text).catch(() => {})
  }, [])

  // Shared panel for each system
  const SystemPanel = ({
    title,
    color,
    items,
    count,
    page,
    onPageChange,
  }: {
    title: "Ayurveda" | "Siddha" | "Unani"
    color: string
    items: ConceptMapItem[]
    count: number
    page: number
    onPageChange: (p: number) => void
  }) => {
    const totalPages = Math.max(1, Math.ceil(count / limit))
    return (
      <Card className="bg-white/5 border-white/10 shadow-lg">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${color} text-black`}>{title}</span>
              <Badge variant="secondary" className="ml-1 bg-white/10 text-white border-white/10">
                {count} mappings
              </Badge>
            </div>
            <span className="text-xs text-white/60">Page {page} of {totalPages}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white/5 backdrop-blur">
                <tr className="text-left text-white/80">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, idx) => (
                  <tr key={`${m.source_code}-${m.target_code}-${idx}`} className="border-t border-white/10 odd:bg-white/[0.05] even:bg-white/[0.035] hover:bg-white/10">
                    <td className="px-3 py-2">
                      <div className="max-w-[340px]">
                        <div className="text-white/90 text-[0.95rem] font-medium truncate" title={m.source_display || undefined}>
                          {m.source_display || m.source_code}
                        </div>
                        <div className="text-xs text-white/60 italic">
                          {m.source_system}:{" "}
                          <span
                            className="cursor-pointer underline decoration-dotted"
                            title="Click to copy"
                            onClick={() => copyToClipboard(m.source_code)}
                          >
                            {m.source_code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[340px]">
                        <div className="text-white text-[0.95rem] font-semibold truncate" title={m.target_display || undefined}>
                          {m.target_display || m.target_code}
                        </div>
                        <div className="text-xs text-white/60">
                          {m.target_system}:{" "}
                          <span
                            className="cursor-pointer underline decoration-dotted"
                            title="Click to copy"
                            onClick={() => copyToClipboard(m.target_code)}
                          >
                            {m.target_code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-white/80">{titleCase(m.mapping_type)}</td>
                    <td className="px-3 py-2 text-white/80">{m.confidence ?? "-"}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-white/60">
                      No results
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-xs text-white/70">
            <div>Page {page} of {totalPages}</div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === 1}
                onClick={() => onPageChange(1)}
              >
                First
              </Button>
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
              >
                Prev
              </Button>
              <span className="px-2">{page}</span>
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === totalPages}
                onClick={() => onPageChange(totalPages)}
              >
                Last
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Unified panel for All mappings
  const AllUnifiedPanel = ({ items, count, page, onPageChange }: { items: ConceptMapItem[]; count: number; page: number; onPageChange: (p: number) => void }) => {
    const totalPages = Math.max(1, Math.ceil(count / limit))
    return (
      <Card className="bg-white/5 border-white/10 shadow-lg">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-cyan-300 text-black">All Mappings</span>
              <Badge variant="secondary" className="ml-1 bg-white/10 text-white border-white/10">
                {count} mappings
              </Badge>
            </div>
            <span className="text-xs text-white/60">Page {page} of {totalPages}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white/5 backdrop-blur">
                <tr className="text-left text-white/80">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, idx) => (
                  <tr key={`${m.source_code}-${m.target_code}-${idx}`} className="border-t border-white/10 odd:bg-white/[0.05] even:bg-white/[0.035] hover:bg-white/10">
                    <td className="px-3 py-2">
                      <div className="max-w-[480px]">
                        <div className="text-white/90 text-[0.95rem] font-medium truncate" title={m.source_display || undefined}>
                          {m.source_display || m.source_code}
                        </div>
                        <div className="text-xs text-white/60 italic">
                          {m.source_system}:{" "}
                          <span
                            className="cursor-pointer underline decoration-dotted"
                            title="Click to copy"
                            onClick={() => copyToClipboard(m.source_code)}
                          >
                            {m.source_code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[480px]">
                        <div className="text-white text-[0.95rem] font-semibold truncate" title={m.target_display || undefined}>
                          {m.target_display || m.target_code}
                        </div>
                        <div className="text-xs text-white/60">
                          {m.target_system}:{" "}
                          <span
                            className="cursor-pointer underline decoration-dotted"
                            title="Click to copy"
                            onClick={() => copyToClipboard(m.target_code)}
                          >
                            {m.target_code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-white/80">{titleCase(m.mapping_type)}</td>
                    <td className="px-3 py-2 text-white/80">{m.confidence ?? "-"}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-white/60">
                      No results
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-xs text-white/70">
            <div>Page {page} of {totalPages}</div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === 1}
                onClick={() => onPageChange(1)}
              >
                First
              </Button>
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
              >
                Prev
              </Button>
              <span className="px-2">{page}</span>
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
              <Button
                variant="outline"
                className="h-7 border-white/20 bg-white/5 text-white hover:bg-white/10"
                disabled={page === totalPages}
                onClick={() => onPageChange(totalPages)}
              >
                Last
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Local button to toggle the patient sidebar
  const MyPatientsButton: React.FC = () => {
    return (
      <Button onClick={() => setActiveView("patients")} className="h-10 rounded-xl bg-gradient-to-r from-fuchsia-400 to-pink-500 text-black font-semibold">
        My Patients
      </Button>
    )
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} defaultOpen={false}>
      <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-[#0b0f19] via-[#0b0f19] to-black text-white">
        {/* Subtle background pattern */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute top-[-12%] left-[-8%] h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="absolute bottom-[-12%] right-[-8%] h-72 w-72 rounded-full bg-emerald-500/5 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
        </div>

        {/* Sidebar */}
        <Sidebar collapsible="offcanvas" className="bg-black/60 backdrop-blur border-r border-white/10">
          <SidebarHeader>
            <div className="flex items-center gap-3 p-2">
              <Image src="/images/ayusetu_logo.jpg" alt="AYUSetu" width={36} height={36} className="rounded" />
              <div>
                <div className="text-sm font-semibold">AYUSetu Doctor</div>
                <div className="text-xs text-white/60">Care • Mappings • Patients</div>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard">
                      <Home className="mr-2 h-4 w-4" /> Dashboard
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/doctor/form">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New Patient
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                      <SidebarMenuButton>
                        <LinkIcon className="mr-2 h-4 w-4" /> Add Mapping Suggestion
                      </SidebarMenuButton>
                    </DialogTrigger>
                    <DialogContent className="bg-black/90 border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>Add Mapping Suggestion</DialogTitle>
                        <DialogDescription>
                          Submit a mapping you know that is missing. We will review and add it to the system.
                        </DialogDescription>
                      </DialogHeader>
                      <form className="space-y-4" onSubmit={submitNewMapping}>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-white/80">Source System</Label>
                            <Select value={addSystem} onValueChange={setAddSystem}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white/90">
                                <SelectValue placeholder="Choose" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ayurveda">Ayurveda</SelectItem>
                                <SelectItem value="siddha">Siddha</SelectItem>
                                <SelectItem value="unani">Unani</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-white/80">Target System</Label>
                            <Select value={addTargetSystem} onValueChange={setAddTargetSystem}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white/90">
                                <SelectValue placeholder="Choose target" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ICD-11 TM2">ICD-11 TM2</SelectItem>
                                <SelectItem value="ICD-11 Biomedicine">ICD-11 Biomedicine</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-white/80">Source Code</Label>
                            <Input value={addSourceCode} onChange={(e) => setAddSourceCode(e.target.value)} placeholder="e.g. AYU-123" className="bg-white/5 border-white/10 text-white" />
                          </div>
                          <div>
                            <Label className="text-white/80">Target Code (optional)</Label>
                            <Input value={addTargetCode} onChange={(e) => setAddTargetCode(e.target.value)} placeholder="e.g. XM12" className="bg-white/5 border-white/10 text-white" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-white/80">Source Display/Description</Label>
                          <Input value={addSourceDisplay} onChange={(e) => setAddSourceDisplay(e.target.value)} placeholder="Short description" className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div>
                          <Label className="text-white/80">Notes</Label>
                          <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Any additional context" className="bg-white/5 border-white/10 text-white" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} className="text-white/80">Cancel</Button>
                          <Button type="submit" className="bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-semibold">Submit</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel>Patients</SidebarGroupLabel>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search patients"
                    className="pl-8 bg-white/5 border-white/10 text-white h-9"
                  />
                </div>
              </div>
              <div className="max-h-[40vh] overflow-auto px-2">
                {patientsLoading && (
                  <div className="text-sm text-white/60 px-2 py-1">Loading...</div>
                )}
                {patientsError && (
                  <div className="text-sm text-red-400 px-2 py-1">{patientsError}</div>
                )}
                {!patientsLoading && !patientsError && filteredPatients.length === 0 && (
                  <div className="text-sm text-white/60 px-2 py-2">No patients yet</div>
                )}
                <ul className="space-y-1">
                  {filteredPatients.map((p) => (
                    <li key={p.id}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-left hover:bg-white/5"
                        onClick={() => openPatient(p)}
                      >
                        <Users className="mr-2 h-4 w-4 text-cyan-300" />
                        <span className="truncate">{p.patient_name}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <Button onClick={handleLogout} variant="ghost" className="justify-start text-red-300 hover:text-red-200 hover:bg-red-500/10">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </SidebarFooter>
        </Sidebar>

        {/* Main content */}
        <SidebarInset className="bg-transparent">
          {/* Top bar with logo and search */}
          <div className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Sidebar toggle for all screens */}
                <SidebarTrigger className="text-white/80 hover:text-white hover:bg-white/10" />
                {/* Top-left logo (larger) */}
                <Image src="/images/ayusetu_logo.png" alt="AYUSetu" width={48} height={48} className="rounded" />
                <h1 className="text-lg md:text-xl font-semibold tracking-tight flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-300" /> Doctor Dashboard
                </h1>
              </div>
              <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
                <Button onClick={() => router.push("/")} variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">Logout</Button>
                <MyPatientsButton />
                <div className="relative w-full max-w-xl">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <Input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search across Ayurveda, Siddha, Unani mappings"
                    className="pl-9 pr-28 h-10 rounded-xl bg-white/5 border-white/10 text-white shadow-sm"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Select
                      value={String(limit)}
                      onValueChange={(v) => {
                        setLimit(Number(v))
                        setPageAyur(1)
                        setPageSiddha(1)
                        setPageUnani(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[72px] border-white/15 bg-white/5 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0b0f19] text-white">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={refreshAll} className="h-10 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-semibold">
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs to optionally focus a system */}
          <div className="mx-auto max-w-7xl px-4 pt-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-white/10 border border-white/20 text-white">
                <TabsTrigger className="text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white" value="all">All</TabsTrigger>
                <TabsTrigger className="text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white" value="ayurveda">Ayurveda</TabsTrigger>
                <TabsTrigger className="text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white" value="siddha">Siddha</TabsTrigger>
                <TabsTrigger className="text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white" value="unani">Unani</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Main area */}
          <div className="mx-auto max-w-7xl px-4 py-6">
            {activeView === "patients" ? (
              // Patients full-page list
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">My Patients</h2>
                  <Button onClick={() => setActiveView("mappings")} variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">Back to Mappings</Button>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 shadow-sm overflow-hidden">
                  <div className="p-3 border-b border-white/10">
                    <div className="relative max-w-md">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/50" />
                      <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search patients" className="pl-8 bg-white/5 border-white/10 text-white h-9" />
                    </div>
                  </div>
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5">
                        <tr className="text-left text-white/80">
                          <th className="px-3 py-2 font-medium">ID</th>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Age</th>
                          <th className="px-3 py-2 font-medium">Sex</th>
                          <th className="px-3 py-2 font-medium">Diagnosis</th>
                          <th className="px-3 py-2 font-medium">ICD System</th>
                          <th className="px-3 py-2 font-medium">ICD Code</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.map((p) => {
                          const mapped = Boolean(p.icd_system && p.icd_code)
                          return (
                            <tr
                              key={p.id}
                              className="border-t border-white/10 hover:bg-white/10 cursor-pointer"
                              onClick={() => openPatient(p)}
                            >
                              <td className="px-3 py-2">{p.id}</td>
                              <td className="px-3 py-2 font-medium">{p.patient_name}</td>
                              <td className="px-3 py-2">{p.age ?? "-"}</td>
                              <td className="px-3 py-2">{p.sex ?? "-"}</td>
                              <td className="px-3 py-2">{p.diagnosis ?? "-"}</td>
                              <td className="px-3 py-2">{p.icd_system ?? "-"}</td>
                              <td className="px-3 py-2">
                                {p.icd_code ? (
                                  <span
                                    className="cursor-pointer underline decoration-dotted"
                                    title="Click to copy"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigator.clipboard?.writeText(p.icd_code as string).catch(() => {})
                                    }}
                                  >
                                    {p.icd_code}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {mapped ? (
                                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Mapped</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-white/10 text-white border-white/20">Unmapped</Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {!filteredPatients.length && (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-white/60">No patients found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              // Mappings view
              <>
                <div className="grid grid-cols-1 gap-4">
                  {activeTab === "all" ? (
                    <AllUnifiedPanel
                      items={mapsAll}
                      count={countAll}
                      page={pageAll}
                      onPageChange={setPageAll}
                    />
                  ) : (
                    <>
                      {activeTab === "ayurveda" && (
                        <SystemPanel title="Ayurveda" color="bg-red-400" items={mapsAyur} count={countAyur} page={pageAyur} onPageChange={setPageAyur} />
                      )}
                      {activeTab === "siddha" && (
                        <SystemPanel title="Siddha" color="bg-yellow-400" items={mapsSiddha} count={countSiddha} page={pageSiddha} onPageChange={setPageSiddha} />
                      )}
                      {activeTab === "unani" && (
                        <SystemPanel title="Unani" color="bg-emerald-400" items={mapsUnani} count={countUnani} page={pageUnani} onPageChange={setPageUnani} />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </SidebarInset>

        {/* Patient Details Sheet */}
        <Sheet open={patientSheetOpen} onOpenChange={setPatientSheetOpen}>
          <SheetContent side="right" className="bg-black/90 border-white/10 text-white w-[420px] sm:w-[520px]">
            <SheetHeader>
              <SheetTitle>Patient Details</SheetTitle>
              <SheetDescription>Basic information and mapped diagnosis</SheetDescription>
            </SheetHeader>
            {selectedPatient ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{selectedPatient.patient_name}</div>
                    <div className="text-sm text-white/60">ID: {selectedPatient.id}</div>
                  </div>
                </div>
                <Separator className="bg-white/10" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-white/70">Age</div>
                  <div className="text-white/90">{selectedPatient.age ?? "-"}</div>
                  <div className="text-white/70">Sex</div>
                  <div className="text-white/90">{selectedPatient.sex ?? "-"}</div>
                  <div className="text-white/70">Diagnosis</div>
                  <div className="text-white/90">{selectedPatient.diagnosis ?? "-"}</div>
                  <div className="text-white/70">ICD System</div>
                  <div className="text-white/90">{selectedPatient.icd_system ?? "-"}</div>
                  <div className="text-white/70">ICD Code</div>
                  <div className="text-white/90">{selectedPatient.icd_code ?? "-"}</div>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-white/60">Select a patient from the sidebar</div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </SidebarProvider>
  )
}