"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { apiGet } from "@/lib/api"
import { Search, Copy, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as d3 from "d3"

// Types
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

export default function Dashboard() {
  // Global UI state
  const [activeView, setActiveView] = useState<"mappings" | "viz">("mappings")
  const [loadingAll, setLoadingAll] = useState(false)

  // Global search + type filter
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all")
  const [limit, setLimit] = useState(10)

  // Per-system pages + results
  const [pageAyur, setPageAyur] = useState(1)
  const [pageSiddha, setPageSiddha] = useState(1)
  const [pageUnani, setPageUnani] = useState(1)

  const [ayurItems, setAyurItems] = useState<ConceptMapItem[]>([])
  const [siddhaItems, setSiddhaItems] = useState<ConceptMapItem[]>([])
  const [unaniItems, setUnaniItems] = useState<ConceptMapItem[]>([])

  const [ayurCount, setAyurCount] = useState(0)
  const [siddhaCount, setSiddhaCount] = useState(0)
  const [unaniCount, setUnaniCount] = useState(0)

  const [loadingAyur, setLoadingAyur] = useState(false)
  const [loadingSiddha, setLoadingSiddha] = useState(false)
  const [loadingUnani, setLoadingUnani] = useState(false)

  // Tips
  const [tips, setTips] = useState<string[]>([])
  const allTips = [
    "Drink at least 8 glasses of water daily.",
    "Get 7-8 hours of sleep every night.",
    "Eat a handful of nuts for healthy fats.",
    "Take a 10-minute walk after meals.",
    "Practice deep breathing exercises.",
    "Stretch for 5 minutes every morning.",
    "Limit processed foods and added sugar.",
    "Include leafy greens in your meals.",
    "Use stairs instead of the elevator.",
    "Take regular screen breaks.",
    "Maintain good posture while sitting.",
    "Eat seasonal fruits daily.",
    "Avoid skipping breakfast.",
    "Practice mindful eating.",
    "Wash hands before meals.",
    "Spend at least 20 mins in sunlight.",
    "Limit caffeine intake.",
    "Chew food slowly and thoroughly.",
    "Get regular health checkups.",
    "Laugh often, reduce stress.",
    "Maintain a consistent sleep schedule.",
    "Cook more meals at home.",
    "Avoid smoking and excessive alcohol.",
    "Include protein in every meal.",
    "Don’t overuse salt in food.",
    "Practice gratitude daily.",
    "Meditate for 10 minutes daily.",
    "Exercise at least 3 times a week.",
    "Eat dinner at least 2 hours before bed.",
    "Reduce late-night screen time.",
    "Drink herbal teas for relaxation.",
    "Try yoga or pilates for flexibility.",
    "Avoid junk food as much as possible.",
    "Replace soda with water or coconut water.",
    "Practice portion control.",
    "Get at least 5000 steps a day.",
    "Keep a positive attitude.",
    "Do regular stretching at your desk.",
    "Eat probiotic-rich foods like yogurt.",
    "Sleep in a dark, quiet room.",
    "Smile more often, it reduces stress.",
    "Maintain strong social connections.",
    "Avoid overeating at social events.",
    "Listen to calming music.",
    "Practice good oral hygiene.",
    "Eat whole grains instead of refined.",
    "Add seeds like flax or chia to meals.",
    "Don’t ignore early health symptoms.",
    "Always wear sunscreen outdoors.",
  ]

  // Helpers
  const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
  const copyToClipboard = useCallback((text: string) => {
    if (!text) return
    navigator.clipboard?.writeText(text).catch(() => {})
  }, [])

  // Export helper per system
  const exportCSV = useCallback((items: ConceptMapItem[], suffix: string) => {
    const headers = [
      "source_system",
      "source_code",
      "source_display",
      "target_system",
      "target_code",
      "target_display",
      "mapping_type",
      "confidence",
    ]
    const rows = items.map((m) => [
      m.source_system,
      m.source_code,
      (m.source_display ?? "").toString().replace(/\n/g, " "),
      m.target_system,
      m.target_code,
      (m.target_display ?? "").toString().replace(/\n/g, " "),
      m.mapping_type,
      m.confidence ?? "",
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `conceptmaps_${suffix}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Fetchers (per system)
  const fetchSystem = useCallback(
    async (system: "ayurveda" | "siddha" | "unani", page: number) => {
      const path = search
        ? `/conceptmaps?system=${system}&search=${encodeURIComponent(search)}&limit=${limit}&offset=${(page - 1) * limit}`
        : `/conceptmaps?system=${system}&limit=${limit}&offset=${(page - 1) * limit}`
      const resp = await apiGet<{ count: number; items: ConceptMapItem[] }>(path)
      return resp
    },
    [search, limit]
  )

  const refreshAll = useCallback(async () => {
    setLoadingAll(true)
    setLoadingAyur(true)
    setLoadingSiddha(true)
    setLoadingUnani(true)
    try {
      const [a, s, u] = await Promise.all([
        fetchSystem("ayurveda", pageAyur),
        fetchSystem("siddha", pageSiddha),
        fetchSystem("unani", pageUnani),
      ])
      setAyurItems(a.items || [])
      setAyurCount(a.count || 0)
      setSiddhaItems(s.items || [])
      setSiddhaCount(s.count || 0)
      setUnaniItems(u.items || [])
      setUnaniCount(u.count || 0)
    } catch (e) {
      setAyurItems([])
      setAyurCount(0)
      setSiddhaItems([])
      setSiddhaCount(0)
      setUnaniItems([])
      setUnaniCount(0)
    } finally {
      setLoadingAyur(false)
      setLoadingSiddha(false)
      setLoadingUnani(false)
      setLoadingAll(false)
    }
  }, [fetchSystem, pageAyur, pageSiddha, pageUnani])

  // Initial and on-change loads
  useEffect(() => {
    // rotate tips
    const shuffled = [...allTips].sort(() => 0.5 - Math.random())
    setTips(shuffled.slice(0, 3))
  }, [])

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      setPageAyur(1)
      setPageSiddha(1)
      setPageUnani(1)
      refreshAll()
    }, 400)
    return () => clearTimeout(id)
  }, [search, limit, refreshAll])

  // Refresh when any page changes
  useEffect(() => {
    refreshAll()
  }, [pageAyur, pageSiddha, pageUnani, refreshAll])

  // Derived: combined items for type filter + viz
  const combinedItems = useMemo(() => [...ayurItems, ...siddhaItems, ...unaniItems], [ayurItems, unaniItems, siddhaItems])

  const mappingTypeCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of combinedItems) {
      const key = (m.mapping_type || "unknown").toLowerCase()
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [combinedItems])
  const mappingTypes = useMemo(() => Array.from(mappingTypeCounts.keys()), [mappingTypeCounts])

  const filterByType = useCallback(
    (items: ConceptMapItem[]) =>
      typeFilter === "all"
        ? items
        : items.filter((m) => (m.mapping_type || "unknown").toLowerCase() === typeFilter),
    [typeFilter]
  )

  // D3 visualization uses combinedItems
  useEffect(() => {
    if (activeView !== "viz") return
    if (!combinedItems || combinedItems.length === 0) return

    const container = d3.select("#viz-container")
    if (container.empty()) return

    container.selectAll("*").remove()

    const el = document.getElementById("viz-container")
    if (!el) return

    const width = el.clientWidth || 800
    const height = el.clientHeight || 560 // explicit container height provided via class

    const svg = container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("class", "select-none")

    // Effects and gradients
    const defs = svg.append("defs")
    const glow = defs
      .append("filter")
      .attr("id", "glow")
      .attr("height", "300%")
      .attr("width", "300%")
      .attr("x", "-100%")
      .attr("y", "-100%")
    glow.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "coloredBlur")
    const feMerge = glow.append("feMerge")
    feMerge.append("feMergeNode").attr("in", "coloredBlur")
    feMerge.append("feMergeNode").attr("in", "SourceGraphic")

    const g = svg.append("g") // zoom/pan group

    type NodeDatum = {
      id: string
      label: string
      type: "source" | "target"
      x?: number
      y?: number
      vx?: number
      vy?: number
      fx?: number | null
      fy?: number | null
    }
    type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & {
      type: string
      confidence?: number | null
    }

    const nodes: NodeDatum[] = []
    const links: LinkDatum[] = []

    combinedItems.forEach((m) => {
      const src = `${m.source_system}:${m.source_code}`
      const tgt = `${m.target_system}:${m.target_code}`

      if (!nodes.find((n) => n.id === src)) {
        nodes.push({ id: src, label: m.source_display || m.source_code, type: "source" })
      }
      if (!nodes.find((n) => n.id === tgt)) {
        nodes.push({ id: tgt, label: m.target_display || m.target_code, type: "target" })
      }
      links.push({
        source: src,
        target: tgt,
        type: m.mapping_type,
        confidence: m.confidence ?? undefined,
      })
    })

    const simulation = d3
      .forceSimulation<NodeDatum>(nodes)
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(links)
          .id((d) => d.id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))

    const link = g
      .append("g")
      .attr("stroke", "#60a5fa")
      .attr("stroke-opacity", 0.5)
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => (d.confidence ? 1.5 : 1))
      .attr("stroke-dasharray", (d) => (d.type && d.type.toLowerCase() !== "equivalent" ? "4 3" : ""))

    link.append("title").text((d) => `${d.type}${d.confidence ? ` (${d.confidence})` : ""}`)

    const node = g
      .append("g")
      .selectAll<SVGCircleElement, NodeDatum>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", (d) => (d.type === "source" ? "#22d3ee" : "#f59e0b"))
      .attr("filter", "url(#glow)")
      .call(
        d3
          .drag<SVGCircleElement, NodeDatum>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    node.append("title").text((d) => d.label)

    const label = g
      .append("g")
      .selectAll<SVGTextElement, NodeDatum>("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", "0.35em")
      .attr("fill", "#e5e7eb")

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (typeof d.source === "object" ? (d.source as NodeDatum).x ?? 0 : 0))
        .attr("y1", (d) => (typeof d.source === "object" ? (d.source as NodeDatum).y ?? 0 : 0))
        .attr("x2", (d) => (typeof d.target === "object" ? (d.target as NodeDatum).x ?? 0 : 0))
        .attr("y2", (d) => (typeof d.target === "object" ? (d.target as NodeDatum).y ?? 0 : 0))

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0)

      label.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0)
    })

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform)
        })
    )

    return () => {
      simulation.stop()
      container.selectAll("*").remove()
    }
  }, [combinedItems, activeView])

  // UI helpers
  const SystemPanel = ({
    title,
    color,
    items,
    count,
    page,
    onPageChange,
    suffix,
  }: {
    title: string
    color: string
    items: ConceptMapItem[]
    count: number
    page: number
    onPageChange: (p: number) => void
    suffix: string
  }) => {
    const filtered = filterByType(items)
    const totalPages = Math.max(1, Math.ceil(count / limit))

    return (
      <div className="flex min-h-[22rem] flex-col rounded-xl border border-white/10 bg-white/[0.04] shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
            <h3 className="text-sm font-semibold text-white/90">{title}</h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">{count}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={() => exportCSV(filtered, suffix)}
              title={`Export ${suffix}`}
            >
              <Download className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="sticky top-0 z-10 bg-white/5 backdrop-blur">
              <tr className="text-left text-white/80">
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <tr key={`${m.source_code}-${m.target_code}-${idx}`} className="border-t border-white/10 odd:bg-white/[0.05] even:bg-white/[0.035] hover:bg-white/[0.08]">
                  <td className="px-3 py-2">
                    <div className="max-w-[320px]">
                      <div className="text-white text-[0.9rem] font-medium truncate" title={m.source_display || undefined}>
                        {m.source_display || m.source_code}
                      </div>
                      <div className="text-[0.75rem] text-white/60">
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
                    <div className="max-w-[320px]">
                      <div className="text-white text-[0.9rem] font-medium truncate" title={m.target_display || undefined}>
                        {m.target_display || m.target_code}
                      </div>
                      <div className="text-[0.75rem] text-white/60">
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
                  <td className="px-3 py-2 text-white/80">{m.mapping_type}</td>
                  <td className="px-3 py-2 text-white/80">{m.confidence ?? "-"}</td>
                </tr>
              ))}
              {!filtered.length && (
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
          <div>
            Page {page} of {totalPages}
          </div>
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
      </div>
    )
  }

  // Counts summary
  const totalAll = ayurCount + siddhaCount + unaniCount

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f19] via-[#0b0f19] to-black text-white">
      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />
      </div>

      {/* Top Nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/images/ayusetu_logo.png"
              alt="AYUSetu Logo"
              className="h-12 md:h-14 object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold tracking-tight">AYUSetu Terminology</h1>
              <p className="text-xs text-white/60">Mappings • Search • Visualize</p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 text-black font-semibold hover:opacity-90"
            >
              <Link href="/doctor/abha_doctor">DOCTOR (ABHA LOGIN)</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 text-black font-semibold hover:opacity-90"
            >
              <Link href="/patient/abha_patient">PATIENT (ABHA LOGIN)</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Health Tips */}
      <section className="mx-auto w-full max-w-7xl px-6 pt-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner">
          <h2 className="mb-2 text-center text-sm font-semibold text-yellow-200">Daily Health Tips</h2>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-center text-xs text-white/90 shadow-sm hover:bg-white/15"
              >
                {tip}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toggle + Info */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div className="inline-flex overflow-hidden rounded-full border border-white/15 bg-white/5 p-1">
          <button
            onClick={() => setActiveView("mappings")}
            className={`px-4 py-2 text-sm transition ${
              activeView === "mappings"
                ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black"
                : "text-white/80 hover:bg-white/10"
            } rounded-full`}
          >
            Mappings
          </button>
          <button
            onClick={() => setActiveView("viz")}
            className={`px-4 py-2 text-sm transition ${
              activeView === "viz"
                ? "bg-gradient-to-r from-cyan-400 to-blue-400 text-black"
                : "text-white/80 hover:bg-white/10"
            } rounded-full`}
          >
            Visualizations
          </button>
        </div>
        <div className="hidden text-sm text-white/70 sm:block">
          {totalAll > 0 ? (
            <span>
              Total results: {totalAll}
              {typeFilter !== "all" && (
                <span className="text-white/50"> • filtered on page (visible): {combinedItems.length}</span>
              )}
            </span>
          ) : (
            <span>Search and browse terminology mappings</span>
          )}
        </div>
      </div>

      {/* Content area */}
      <main className="mx-auto w-full max-w-7xl px-6 pb-12">
        {activeView === "mappings" ? (
          <div className="flex min-h-[70vh] flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f19]/80 p-6 shadow-lg">
            {/* Search + Controls */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
                  <input
                    type="text"
                    placeholder="Search across Ayurveda, Siddha, Unani (Press Enter)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPageAyur(1)
                        setPageSiddha(1)
                        setPageUnani(1)
                        refreshAll()
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-32 py-2.5 text-sm text-white placeholder:text-white/50 outline-none ring-0 focus:border-cyan-400/40"
                    aria-label="Search for terminology"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 space-x-2">
                    <Button
                      className="h-8 bg-yellow-400 text-black hover:bg-yellow-500"
                      onClick={() => {
                        setPageAyur(1)
                        setPageSiddha(1)
                        setPageUnani(1)
                        refreshAll()
                      }}
                    >
                      Search
                    </Button>
                  </div>
                </div>

                {/* Show entries */}
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <span>Show</span>
                  <Select
                    value={limit.toString()}
                    onValueChange={(val) => {
                      setLimit(Number(val))
                      setPageAyur(1)
                      setPageSiddha(1)
                      setPageUnani(1)
                    }}
                  >
                    <SelectTrigger className="w-24 border-white/15 bg-white/5 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0f19] text-white">
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>entries</span>
                </div>
              </div>

              {/* Quick filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    typeFilter === "all"
                      ? "border-yellow-400 bg-yellow-400 text-black"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                  onClick={() => setTypeFilter("all")}
                >
                  All ({combinedItems.length})
                </button>
                {mappingTypes.map((t) => (
                  <button
                    key={t}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      typeFilter === t
                        ? "border-cyan-400 bg-cyan-400 text-black"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => setTypeFilter(t)}
                  >
                    {titleCase(t)} ({mappingTypeCounts.get(t) || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Three system panels */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SystemPanel
                title="Ayurveda"
                color="bg-cyan-400"
                items={ayurItems}
                count={ayurCount}
                page={pageAyur}
                onPageChange={setPageAyur}
                suffix={`ayurveda_p${pageAyur}`}
              />
              <SystemPanel
                title="Siddha"
                color="bg-amber-400"
                items={siddhaItems}
                count={siddhaCount}
                page={pageSiddha}
                onPageChange={setPageSiddha}
                suffix={`siddha_p${pageSiddha}`}
              />
              <SystemPanel
                title="Unani"
                color="bg-emerald-400"
                items={unaniItems}
                count={unaniCount}
                page={pageUnani}
                onPageChange={setPageUnani}
                suffix={`unani_p${pageUnani}`}
              />
            </div>

            {loadingAll && (
              <div className="text-center text-sm text-white/60">Loading…</div>
            )}
          </div>
        ) : (
          <div className="relative w-full min-h-[70vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f19]/60">
            {/* Subtle grid background */}
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]"
            />
            {/* Viz container with explicit height to fit screen */}
            <div id="viz-container" className="relative z-10 h-[70vh] w-full" />
          </div>
        )}
      </main>
    </div>
  )
}