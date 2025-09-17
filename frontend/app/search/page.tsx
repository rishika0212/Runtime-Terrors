"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Filter, ChevronDown, ChevronUp, BookOpen, Globe, Stethoscope, Tag } from "lucide-react"
import Link from "next/link"

// Mock data for demonstration
const mockResults = {
  namaste: [
    {
      id: "n001",
      code: "JWARA-001",
      name: "Jwara",
      definition: "Fever characterized by increased body temperature, often accompanied by chills and sweating",
      laymanDescription:
        "A condition where your body temperature rises above normal, making you feel hot and sometimes shivery",
      synonyms: ["Fever", "Pyrexia", "Taapa"],
      system: "Ayurveda",
      mappings: ["ICD-11-TM2-F001", "ICD-11-BM-R50"],
    },
    {
      id: "n002",
      code: "AMAVATA-001",
      name: "Amavata",
      definition: "A condition caused by accumulation of Ama (toxins) in joints, leading to pain and stiffness",
      laymanDescription: "Joint pain and stiffness caused by toxin buildup in the body, similar to arthritis",
      synonyms: ["Rheumatoid Arthritis", "Joint inflammation"],
      system: "Ayurveda",
      mappings: ["ICD-11-TM2-M001", "ICD-11-BM-M06"],
    },
  ],
  icd11tm: [
    {
      id: "t001",
      code: "TM2-F001",
      name: "Traditional Medicine Fever Syndrome",
      definition: "Fever patterns recognized in traditional medicine systems",
      laymanDescription: "Fever as understood and treated in traditional medicine",
      synonyms: ["Traditional Fever", "TM Pyrexia"],
      system: "ICD-11 TM2",
      mappings: ["JWARA-001", "ICD-11-BM-R50"],
    },
  ],
  icd11bio: [
    {
      id: "b001",
      code: "R50",
      name: "Fever, unspecified",
      definition: "Elevation of body temperature above the normal range",
      laymanDescription: "When your body temperature is higher than it should be",
      synonyms: ["Pyrexia", "Hyperthermia"],
      system: "ICD-11 Biomedicine",
      mappings: ["JWARA-001", "TM2-F001"],
    },
  ],
}

const systemColors = {
  Ayurveda: "bg-primary text-primary-foreground",
  Siddha: "bg-chart-5 text-white",
  Unani: "bg-chart-4 text-white",
  "ICD-11 TM2": "bg-secondary text-secondary-foreground",
  "ICD-11 Biomedicine": "bg-chart-3 text-white",
}

const relatedQueries = [
  "Respiratory disorders",
  "Digestive issues",
  "Joint pain",
  "Skin conditions",
  "Mental health",
  "Cardiovascular",
  "Neurological",
  "Metabolic disorders",
]

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState(mockResults)
  const [expandedCards, setExpandedCards] = useState<string[]>([])
  const [activeFilters, setActiveFilters] = useState<string[]>(["Ayurveda", "ICD-11 TM2", "ICD-11 Biomedicine"])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    // Simulate API call
    setTimeout(() => {
      setIsSearching(false)
      // In real implementation, this would filter based on the query
    }, 1000)
  }

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]))
  }

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => (prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]))
  }

  const handleRelatedQuery = (query: string) => {
    setSearchQuery(query)
    handleSearch(query)
  }

  const ResultCard = ({ result, type }: { result: any; type: string }) => {
    const isExpanded = expandedCards.includes(result.id)
    const cardColor =
      type === "namaste"
        ? "border-primary/30 hover:border-primary/50"
        : type === "icd11tm"
          ? "border-secondary/30 hover:border-secondary/50"
          : "border-chart-3/30 hover:border-chart-3/50"

    return (
      <Card className={`${cardColor} transition-all duration-200 hover:shadow-lg`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={systemColors[result.system]}>{result.system}</Badge>
                <code className="text-sm bg-muted px-2 py-1 rounded">{result.code}</code>
              </div>
              <CardTitle className="text-xl font-serif">{result.name}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggleCardExpansion(result.id)} className="ml-2">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-foreground/80 mb-3 leading-relaxed">{result.definition}</p>

          {isExpanded && (
            <div className="space-y-4 border-t border-border pt-4">
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Patient-Friendly Description</h4>
                <p className="text-foreground/90 leading-relaxed">{result.laymanDescription}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Synonyms & Related Terms</h4>
                <div className="flex flex-wrap gap-2">
                  {result.synonyms.map((synonym: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {synonym}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Cross-System Mappings</h4>
                <div className="flex flex-wrap gap-2">
                  {result.mappings.map((mapping: string, index: number) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 bg-transparent"
                      onClick={() => handleRelatedQuery(mapping)}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {mapping}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
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
              <Link href="/visualize" className="text-foreground hover:text-primary transition-colors">
                Visualize
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
        {/* Search Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-bold mb-4 text-balance">Search & Explore Medical Codes</h1>
          <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
            Search across traditional and modern medical classification systems
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="Search for diseases, conditions, or codes (e.g., 'fever', 'jwara', 'R50')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch(searchQuery)}
              className="pl-12 pr-4 py-6 text-lg border-2 border-border focus:border-primary"
            />
            <Button
              onClick={() => handleSearch(searchQuery)}
              disabled={isSearching}
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
            >
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter by system:</span>
            </div>
            {Object.keys(systemColors).map((system) => (
              <Button
                key={system}
                variant={activeFilters.includes(system) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleFilter(system)}
                className="text-xs"
              >
                {system}
              </Button>
            ))}
          </div>
        </div>

        {/* Related Query Chips */}
        <div className="max-w-4xl mx-auto mb-12">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Popular searches:</h3>
          <div className="flex flex-wrap gap-2">
            {relatedQueries.map((query) => (
              <Button
                key={query}
                variant="outline"
                size="sm"
                onClick={() => handleRelatedQuery(query)}
                className="text-xs h-8"
              >
                <Tag className="w-3 h-3 mr-1" />
                {query}
              </Button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="namaste" className="text-primary">
                NAMASTE
              </TabsTrigger>
              <TabsTrigger value="icd11tm" className="text-secondary-foreground">
                ICD-11 TM2
              </TabsTrigger>
              <TabsTrigger value="icd11bio" className="text-chart-3">
                ICD-11 Bio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-8">
              {/* NAMASTE Results */}
              {activeFilters.includes("Ayurveda") && (
                <div>
                  <h2 className="text-2xl font-serif font-semibold mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-primary-foreground" />
                    </div>
                    NAMASTE (Traditional Medicine)
                  </h2>
                  <div className="grid gap-4">
                    {results.namaste.map((result) => (
                      <ResultCard key={result.id} result={result} type="namaste" />
                    ))}
                  </div>
                </div>
              )}

              {/* ICD-11 TM2 Results */}
              {activeFilters.includes("ICD-11 TM2") && (
                <div>
                  <h2 className="text-2xl font-serif font-semibold mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-secondary rounded flex items-center justify-center">
                      <Globe className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    ICD-11 Traditional Medicine 2
                  </h2>
                  <div className="grid gap-4">
                    {results.icd11tm.map((result) => (
                      <ResultCard key={result.id} result={result} type="icd11tm" />
                    ))}
                  </div>
                </div>
              )}

              {/* ICD-11 Biomedicine Results */}
              {activeFilters.includes("ICD-11 Biomedicine") && (
                <div>
                  <h2 className="text-2xl font-serif font-semibold mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 bg-chart-3 rounded flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-white" />
                    </div>
                    ICD-11 Biomedicine
                  </h2>
                  <div className="grid gap-4">
                    {results.icd11bio.map((result) => (
                      <ResultCard key={result.id} result={result} type="icd11bio" />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="namaste">
              <div className="grid gap-4">
                {results.namaste.map((result) => (
                  <ResultCard key={result.id} result={result} type="namaste" />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="icd11tm">
              <div className="grid gap-4">
                {results.icd11tm.map((result) => (
                  <ResultCard key={result.id} result={result} type="icd11tm" />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="icd11bio">
              <div className="grid gap-4">
                {results.icd11bio.map((result) => (
                  <ResultCard key={result.id} result={result} type="icd11bio" />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
