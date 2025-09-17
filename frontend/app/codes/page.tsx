"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BookOpen,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
  FileText,
  Database,
} from "lucide-react"
import Link from "next/link"

// Mock data for different code systems
const mockCodeSystems = {
  ayurveda: [
    {
      id: "AY001",
      code: "JWARA-001",
      name: "Jwara",
      definition: "Fever characterized by increased body temperature",
      category: "Infectious Diseases",
      mappings: ["TM2-F001", "R50"],
      status: "Active",
    },
    {
      id: "AY002",
      code: "AMAVATA-001",
      name: "Amavata",
      definition: "Joint disorder with toxin accumulation",
      category: "Musculoskeletal",
      mappings: ["TM2-M001", "M06"],
      status: "Active",
    },
    {
      id: "AY003",
      code: "KASA-001",
      name: "Kasa",
      definition: "Cough and respiratory symptoms",
      category: "Respiratory",
      mappings: ["TM2-R001", "R05"],
      status: "Active",
    },
    {
      id: "AY004",
      code: "ATISARA-001",
      name: "Atisara",
      definition: "Diarrhea and loose stools",
      category: "Digestive",
      mappings: ["TM2-D001", "K59.1"],
      status: "Active",
    },
    {
      id: "AY005",
      code: "SHIRAHSHULA-001",
      name: "Shirahshula",
      definition: "Headache and cranial pain",
      category: "Neurological",
      mappings: ["TM2-N001", "G44"],
      status: "Active",
    },
  ],
  siddha: [
    {
      id: "SI001",
      code: "SURAM-001",
      name: "Suram",
      definition: "Fever in Siddha medicine",
      category: "Infectious Diseases",
      mappings: ["TM2-F002", "R50"],
      status: "Active",
    },
    {
      id: "SI002",
      code: "KEELVAYU-001",
      name: "Keelvayu",
      definition: "Joint pain and arthritis",
      category: "Musculoskeletal",
      mappings: ["TM2-M002", "M25.5"],
      status: "Active",
    },
  ],
  unani: [
    {
      id: "UN001",
      code: "HUMMIYA-001",
      name: "Hummiya",
      definition: "Fever in Unani medicine",
      category: "Infectious Diseases",
      mappings: ["TM2-F003", "R50"],
      status: "Active",
    },
    {
      id: "UN002",
      code: "WAJAULMAFSIL-001",
      name: "Waja-ul-Mafsil",
      definition: "Joint pain and inflammation",
      category: "Musculoskeletal",
      mappings: ["TM2-M003", "M25.5"],
      status: "Active",
    },
  ],
  icd11tm: [
    {
      id: "TM001",
      code: "TM2-F001",
      name: "Traditional Medicine Fever Syndrome",
      definition: "Fever patterns in traditional medicine",
      category: "Traditional Syndromes",
      mappings: ["JWARA-001", "R50"],
      status: "Active",
    },
    {
      id: "TM002",
      code: "TM2-M001",
      name: "Traditional Joint Disorder",
      definition: "Joint conditions in traditional medicine",
      category: "Traditional Syndromes",
      mappings: ["AMAVATA-001", "M06"],
      status: "Active",
    },
  ],
  icd11mms: [
    {
      id: "BM001",
      code: "R50",
      name: "Fever, unspecified",
      definition: "Elevation of body temperature above normal",
      category: "Symptoms and Signs",
      mappings: ["JWARA-001", "TM2-F001"],
      status: "Active",
    },
    {
      id: "BM002",
      code: "M06",
      name: "Rheumatoid arthritis",
      definition: "Chronic inflammatory joint disease",
      category: "Musculoskeletal",
      mappings: ["AMAVATA-001", "TM2-M001"],
      status: "Active",
    },
  ],
}

const systemInfo = {
  ayurveda: {
    name: "Ayurveda",
    description: "Traditional Indian medicine system focusing on balance of doshas",
    color: "bg-primary text-primary-foreground",
    icon: BookOpen,
  },
  siddha: {
    name: "Siddha",
    description: "Traditional Tamil medicine system from South India",
    color: "bg-chart-5 text-white",
    icon: BookOpen,
  },
  unani: {
    name: "Unani",
    description: "Traditional medicine system based on Greek and Arabic principles",
    color: "bg-chart-4 text-white",
    icon: BookOpen,
  },
  icd11tm: {
    name: "ICD-11 TM2",
    description: "WHO International Classification for Traditional Medicine",
    color: "bg-secondary text-secondary-foreground",
    icon: Database,
  },
  icd11mms: {
    name: "ICD-11 MMS",
    description: "WHO International Classification of Diseases - Mortality and Morbidity Statistics",
    color: "bg-chart-3 text-white",
    icon: Database,
  },
}

const ITEMS_PER_PAGE = 10

export default function CodesPage() {
  const [activeTab, setActiveTab] = useState("ayurveda")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortField, setSortField] = useState("code")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  const currentData = mockCodeSystems[activeTab as keyof typeof mockCodeSystems] || []

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(currentData.map((item) => item.category))
    return Array.from(cats)
  }, [currentData])

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    const filtered = currentData.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.definition.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
      return matchesSearch && matchesCategory
    })

    // Sort data
    filtered.sort((a, b) => {
      const aValue = a[sortField as keyof typeof a]
      const bValue = b[sortField as keyof typeof b]
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [currentData, searchTerm, categoryFilter, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE)
  const paginatedData = filteredAndSortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]))
  }

  const exportData = (format: "csv" | "json") => {
    const dataToExport = filteredAndSortedData
    let content = ""
    let filename = ""

    if (format === "csv") {
      const headers = ["Code", "Name", "Definition", "Category", "Status", "Mappings"]
      const csvContent = [
        headers.join(","),
        ...dataToExport.map((item) =>
          [
            item.code,
            item.name,
            `"${item.definition}"`,
            item.category,
            item.status,
            `"${item.mappings.join("; ")}"`,
          ].join(","),
        ),
      ].join("\n")
      content = csvContent
      filename = `${systemInfo[activeTab as keyof typeof systemInfo].name}_codes.csv`
    } else {
      content = JSON.stringify(dataToExport, null, 2)
      filename = `${systemInfo[activeTab as keyof typeof systemInfo].name}_codes.json`
    }

    const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Reset pagination when changing tabs or filters
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setCurrentPage(1)
    setSearchTerm("")
    setCategoryFilter("all")
    setExpandedRows([])
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
              <Link href="/visualize" className="text-foreground hover:text-primary transition-colors">
                Visualize
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
          <h1 className="text-4xl font-serif font-bold mb-4 text-balance">Code Systems Browser</h1>
          <p className="text-xl text-muted-foreground text-pretty max-w-3xl mx-auto">
            Browse and explore medical codes across traditional and modern classification systems
          </p>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="ayurveda" className="text-primary">
              Ayurveda
            </TabsTrigger>
            <TabsTrigger value="siddha" className="text-chart-5">
              Siddha
            </TabsTrigger>
            <TabsTrigger value="unani" className="text-chart-4">
              Unani
            </TabsTrigger>
            <TabsTrigger value="icd11tm" className="text-secondary-foreground">
              ICD-11 TM2
            </TabsTrigger>
            <TabsTrigger value="icd11mms" className="text-chart-3">
              ICD-11 MMS
            </TabsTrigger>
          </TabsList>

          {Object.entries(systemInfo).map(([key, info]) => (
            <TabsContent key={key} value={key} className="space-y-6">
              {/* System Info Card */}
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${info.color}`}>
                      <info.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-serif">{info.name}</CardTitle>
                      <p className="text-muted-foreground mt-1">{info.description}</p>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Controls */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                      {/* Search */}
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          placeholder="Search codes, names, or definitions..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value)
                            setCurrentPage(1)
                          }}
                          className="pl-10"
                        />
                      </div>

                      {/* Category Filter */}
                      <Select
                        value={categoryFilter}
                        onValueChange={(value) => {
                          setCategoryFilter(value)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <Filter className="w-4 h-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportData("csv")}>
                        <Download className="w-4 h-4 mr-2" />
                        CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportData("json")}>
                        <FileText className="w-4 h-4 mr-2" />
                        JSON
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSort("code")}
                            className="h-auto p-0 font-semibold"
                          >
                            Code
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSort("name")}
                            className="h-auto p-0 font-semibold"
                          >
                            Name
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSort("category")}
                            className="h-auto p-0 font-semibold"
                          >
                            Category
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mappings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((item) => (
                        <>
                          <TableRow key={item.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRowExpansion(item.id)}
                                className="h-8 w-8 p-0"
                              >
                                {expandedRows.includes(item.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <code className="bg-muted px-2 py-1 rounded text-sm">{item.code}</code>
                            </TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.mappings.slice(0, 2).map((mapping, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {mapping}
                                  </Badge>
                                ))}
                                {item.mappings.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{item.mappings.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedRows.includes(item.id) && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30">
                                <div className="p-4 space-y-3">
                                  <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">Definition</h4>
                                    <p className="text-foreground/90 leading-relaxed">{item.definition}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                                      All Cross-System Mappings
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {item.mappings.map((mapping, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {mapping}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedData.length)} of{" "}
                    {filteredAndSortedData.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        )
                      })}
                      {totalPages > 5 && <span className="text-muted-foreground">...</span>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
