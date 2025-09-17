"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, ZoomIn, ZoomOut, RotateCcw, Filter, Info } from "lucide-react"
import Link from "next/link"

// Mock data for the network visualization
const mockNodes = [
  // NAMASTE nodes (green)
  { id: "jwara-001", label: "Jwara", group: "namaste", x: 100, y: 150, description: "Fever in Ayurveda" },
  {
    id: "amavata-001",
    label: "Amavata",
    group: "namaste",
    x: 200,
    y: 100,
    description: "Joint disorder with toxin accumulation",
  },
  { id: "kasa-001", label: "Kasa", group: "namaste", x: 150, y: 200, description: "Cough in traditional medicine" },

  // ICD-11 TM2 nodes (blue)
  {
    id: "tm2-f001",
    label: "TM Fever Syndrome",
    group: "icd11tm",
    x: 300,
    y: 150,
    description: "Traditional medicine fever classification",
  },
  {
    id: "tm2-m001",
    label: "TM Joint Disorder",
    group: "icd11tm",
    x: 350,
    y: 100,
    description: "Traditional joint condition",
  },
  {
    id: "tm2-r001",
    label: "TM Respiratory",
    group: "icd11tm",
    x: 320,
    y: 200,
    description: "Traditional respiratory condition",
  },

  // ICD-11 Bio nodes (purple)
  {
    id: "r50",
    label: "Fever (R50)",
    group: "icd11bio",
    x: 500,
    y: 150,
    description: "Biomedical fever classification",
  },
  {
    id: "m06",
    label: "Rheumatoid Arthritis",
    group: "icd11bio",
    x: 550,
    y: 100,
    description: "Autoimmune joint disease",
  },
  {
    id: "r05",
    label: "Cough (R05)",
    group: "icd11bio",
    x: 520,
    y: 200,
    description: "Biomedical cough classification",
  },
]

const mockLinks = [
  // Equivalent mappings
  { source: "jwara-001", target: "tm2-f001", type: "equivalent", strength: 0.9 },
  { source: "tm2-f001", target: "r50", type: "equivalent", strength: 0.8 },
  { source: "amavata-001", target: "tm2-m001", type: "equivalent", strength: 0.85 },
  { source: "tm2-m001", target: "m06", type: "broader", strength: 0.7 },
  { source: "kasa-001", target: "tm2-r001", type: "equivalent", strength: 0.9 },
  { source: "tm2-r001", target: "r05", type: "equivalent", strength: 0.8 },

  // Cross-system relationships
  { source: "jwara-001", target: "r50", type: "narrower", strength: 0.6 },
  { source: "amavata-001", target: "m06", type: "narrower", strength: 0.5 },
]

const nodeColors = {
  namaste: "#059669", // Primary green
  icd11tm: "#eab308", // Secondary saffron
  icd11bio: "#475569", // Chart-3 blue
}

const linkColors = {
  equivalent: "#10b981",
  broader: "#f59e0b",
  narrower: "#ef4444",
}

export default function VisualizePage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [zoomLevel, setZoomLevel] = useState([100])
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const filteredNodes =
    selectedCategory === "all" ? mockNodes : mockNodes.filter((node) => node.group === selectedCategory)

  const filteredLinks = mockLinks.filter((link) => {
    const sourceNode = mockNodes.find((n) => n.id === link.source)
    const targetNode = mockNodes.find((n) => n.id === link.target)
    if (selectedCategory === "all") return true
    return sourceNode?.group === selectedCategory || targetNode?.group === selectedCategory
  })

  const handleNodeClick = (node: any) => {
    setSelectedNode(node)
  }

  const handleZoomIn = () => {
    setZoomLevel([Math.min(zoomLevel[0] + 25, 200)])
    setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.25, 2) }))
  }

  const handleZoomOut = () => {
    setZoomLevel([Math.max(zoomLevel[0] - 25, 25)])
    setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.25) }))
  }

  const handleReset = () => {
    setZoomLevel([100])
    setTransform({ x: 0, y: 0, scale: 1 })
    setSelectedNode(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-serif font-bold text-primary">AYUSetu</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/search" className="text-foreground hover:text-primary transition-colors">
                Search
              </Link>
              <Link href="/codes" className="text-foreground hover:text-primary transition-colors">
                Code Systems
              </Link>
              <Link href="/doctor" className="text-foreground hover:text-primary transition-colors">
                For Doctors
              </Link>
              <Link href="/layman" className="text-foreground hover:text-primary transition-colors">
                Patient Mode
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold mb-4 text-balance">Interactive Knowledge Galaxy</h1>
          <p className="text-xl text-muted-foreground text-pretty max-w-3xl mx-auto">
            Explore the interconnected relationships between traditional and modern medical classifications
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* System Filter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  System Filter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Systems</SelectItem>
                    <SelectItem value="namaste">NAMASTE</SelectItem>
                    <SelectItem value="icd11tm">ICD-11 TM2</SelectItem>
                    <SelectItem value="icd11bio">ICD-11 Biomedicine</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Zoom Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">View Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Zoom Level: {zoomLevel[0]}%</label>
                  <Slider
                    value={zoomLevel}
                    onValueChange={setZoomLevel}
                    max={200}
                    min={25}
                    step={25}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-primary"></div>
                    <span className="text-sm">NAMASTE</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-secondary"></div>
                    <span className="text-sm">ICD-11 TM2</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-chart-3"></div>
                    <span className="text-sm">ICD-11 Bio</span>
                  </div>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-0.5 bg-green-500"></div>
                    <span className="text-xs">Equivalent</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-0.5 bg-yellow-500"></div>
                    <span className="text-xs">Broader</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-0.5 bg-red-500"></div>
                    <span className="text-xs">Narrower</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Node Info */}
            {selectedNode && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Node Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Badge
                      className={`mb-2 ${
                        selectedNode.group === "namaste"
                          ? "bg-primary text-primary-foreground"
                          : selectedNode.group === "icd11tm"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-chart-3 text-white"
                      }`}
                    >
                      {selectedNode.group === "namaste"
                        ? "NAMASTE"
                        : selectedNode.group === "icd11tm"
                          ? "ICD-11 TM2"
                          : "ICD-11 Bio"}
                    </Badge>
                    <h3 className="font-serif font-semibold">{selectedNode.label}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedNode.description}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedNode(null)} className="w-full">
                    Close Details
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Visualization Area */}
          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                <svg
                  ref={svgRef}
                  className="w-full h-full cursor-move"
                  viewBox="0 0 800 600"
                  style={{ transform: `scale(${zoomLevel[0] / 100})` }}
                >
                  {/* Background */}
                  <rect width="800" height="600" fill="transparent" />

                  {/* Links */}
                  <g>
                    {filteredLinks.map((link, index) => {
                      const sourceNode = mockNodes.find((n) => n.id === link.source)
                      const targetNode = mockNodes.find((n) => n.id === link.target)
                      if (!sourceNode || !targetNode) return null

                      return (
                        <line
                          key={index}
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          stroke={linkColors[link.type as keyof typeof linkColors]}
                          strokeWidth={link.strength * 3}
                          strokeOpacity={0.6}
                          className="transition-all duration-200"
                        />
                      )
                    })}
                  </g>

                  {/* Nodes */}
                  <g>
                    {filteredNodes.map((node) => (
                      <g key={node.id}>
                        {/* Node glow effect when hovered */}
                        {hoveredNode === node.id && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="25"
                            fill={nodeColors[node.group as keyof typeof nodeColors]}
                            fillOpacity={0.2}
                            className="animate-pulse"
                          />
                        )}

                        {/* Main node circle */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="15"
                          fill={nodeColors[node.group as keyof typeof nodeColors]}
                          stroke={selectedNode?.id === node.id ? "#ffffff" : "transparent"}
                          strokeWidth={selectedNode?.id === node.id ? 3 : 0}
                          className="cursor-pointer transition-all duration-200 hover:r-18"
                          onClick={() => handleNodeClick(node)}
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                        />

                        {/* Node label */}
                        <text
                          x={node.x}
                          y={node.y + 30}
                          textAnchor="middle"
                          className="text-xs font-medium fill-foreground pointer-events-none"
                          style={{ fontSize: "12px" }}
                        >
                          {node.label}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
              </CardContent>
            </Card>

            {/* Instructions */}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Click on nodes to view details • Use controls to filter and zoom • Hover over connections to see
              relationship types
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
