"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  BookOpen,
  Search,
  Copy,
  CheckCircle,
  Stethoscope,
  FileText,
  Code,
  Download,
  AlertCircle,
  User,
  Calendar,
} from "lucide-react"
import Link from "next/link"

// Mock FHIR data
const mockFHIRCondition = {
  resourceType: "Condition",
  id: "ayurveda-amavata-001",
  meta: {
    profile: ["http://hl7.org/fhir/StructureDefinition/Condition"],
  },
  clinicalStatus: {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code: "active",
        display: "Active",
      },
    ],
  },
  verificationStatus: {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        code: "confirmed",
        display: "Confirmed",
      },
    ],
  },
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis",
        },
      ],
    },
  ],
  code: {
    coding: [
      {
        system: "http://namaste.who.int/CodeSystem/ayurveda",
        code: "AMAVATA-001",
        display: "Amavata",
      },
      {
        system: "http://id.who.int/icd/release/11/mms",
        code: "M06",
        display: "Rheumatoid arthritis",
      },
      {
        system: "http://id.who.int/icd/release/11/tm2",
        code: "TM2-M001",
        display: "Traditional Joint Disorder",
      },
    ],
  },
  subject: {
    reference: "Patient/example-patient",
    display: "John Doe",
  },
  encounter: {
    reference: "Encounter/example-encounter",
  },
  onsetDateTime: "2024-01-15",
  recordedDate: "2024-01-20T10:30:00Z",
  recorder: {
    reference: "Practitioner/example-practitioner",
    display: "Dr. Sarah Johnson",
  },
  note: [
    {
      text: "Patient presents with joint pain and stiffness consistent with Amavata. Traditional Ayurvedic assessment indicates Ama accumulation in joints with Vata aggravation.",
    },
  ],
}

const mockSearchResults = [
  {
    id: "amavata-001",
    traditional: {
      system: "Ayurveda",
      code: "AMAVATA-001",
      name: "Amavata",
      description: "Joint disorder characterized by Ama (toxin) accumulation with Vata aggravation",
    },
    icd11tm: {
      code: "TM2-M001",
      name: "Traditional Joint Disorder",
      description: "Joint conditions recognized in traditional medicine systems",
    },
    icd11bio: {
      code: "M06",
      name: "Rheumatoid arthritis",
      description: "Chronic inflammatory joint disease",
    },
    confidence: 0.92,
  },
  {
    id: "sandhivata-001",
    traditional: {
      system: "Ayurveda",
      code: "SANDHIVATA-001",
      name: "Sandhivata",
      description: "Joint pain due to Vata dosha aggravation",
    },
    icd11tm: {
      code: "TM2-M002",
      name: "Traditional Joint Pain",
      description: "Joint pain patterns in traditional medicine",
    },
    icd11bio: {
      code: "M25.5",
      name: "Pain in joint",
      description: "Joint pain, unspecified",
    },
    confidence: 0.78,
  },
]

export default function DoctorPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedResult, setSelectedResult] = useState<any>(null)
  const [patientInfo, setPatientInfo] = useState({
    name: "John Doe",
    age: "45",
    gender: "Male",
    id: "P001234",
  })
  const [clinicalNotes, setClinicalNotes] = useState("")
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = () => {
    if (!searchTerm.trim()) return
    setIsSearching(true)
    // Simulate API call
    setTimeout(() => {
      setIsSearching(false)
      setSelectedResult(null)
    }, 1000)
  }

  const handleResultSelect = (result: any) => {
    setSelectedResult(result)
    setClinicalNotes(
      `Patient presents with symptoms consistent with ${result.traditional.name} (${result.traditional.code}). ` +
        `Traditional assessment: ${result.traditional.description}. ` +
        `Mapped to ICD-11: ${result.icd11bio.name} (${result.icd11bio.code}).`,
    )
  }

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates({ ...copiedStates, [key]: true })
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [key]: false })
      }, 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const generateFHIRBundle = () => {
    if (!selectedResult) return null

    return {
      resourceType: "Bundle",
      id: "ayusetu-condition-bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            ...mockFHIRCondition,
            code: {
              coding: [
                {
                  system: "http://namaste.who.int/CodeSystem/ayurveda",
                  code: selectedResult.traditional.code,
                  display: selectedResult.traditional.name,
                },
                {
                  system: "http://id.who.int/icd/release/11/mms",
                  code: selectedResult.icd11bio.code,
                  display: selectedResult.icd11bio.name,
                },
                {
                  system: "http://id.who.int/icd/release/11/tm2",
                  code: selectedResult.icd11tm.code,
                  display: selectedResult.icd11tm.name,
                },
              ],
            },
            subject: {
              reference: `Patient/${patientInfo.id}`,
              display: patientInfo.name,
            },
            note: [
              {
                text: clinicalNotes,
              },
            ],
          },
        },
      ],
    }
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
              <Link href="/codes" className="text-foreground hover:text-primary transition-colors">
                Code Systems
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
          <h1 className="text-4xl font-serif font-bold mb-4 text-balance">Doctor Workflow Demo</h1>
          <p className="text-xl text-muted-foreground text-pretty max-w-3xl mx-auto">
            Streamline your practice with integrated traditional and modern medical coding
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Patient Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patientName">Name</Label>
                    <Input
                      id="patientName"
                      value={patientInfo.name}
                      onChange={(e) => setPatientInfo({ ...patientInfo, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="patientAge">Age</Label>
                    <Input
                      id="patientAge"
                      value={patientInfo.age}
                      onChange={(e) => setPatientInfo({ ...patientInfo, age: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patientGender">Gender</Label>
                    <Input
                      id="patientGender"
                      value={patientInfo.gender}
                      onChange={(e) => setPatientInfo({ ...patientInfo, gender: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="patientId">Patient ID</Label>
                    <Input
                      id="patientId"
                      value={patientInfo.id}
                      onChange={(e) => setPatientInfo({ ...patientInfo, id: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Clinical Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter clinical observations and notes..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* Main Workflow */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Condition Lookup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter traditional medicine term (e.g., 'Amavata', 'Jwara')..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? "Searching..." : "Search"}
                  </Button>
                </div>

                {/* Search Results */}
                {!isSearching && searchTerm && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Search Results</h3>
                    {mockSearchResults.map((result) => (
                      <Card
                        key={result.id}
                        className={`cursor-pointer transition-all ${
                          selectedResult?.id === result.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                        }`}
                        onClick={() => handleResultSelect(result)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-lg">{result.traditional.name}</h4>
                              <Badge className="bg-primary text-primary-foreground mt-1">
                                {result.traditional.system}
                              </Badge>
                            </div>
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              {Math.round(result.confidence * 100)}% match
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{result.traditional.description}</p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-medium">ICD-11 TM2:</span>
                              <br />
                              <code className="bg-muted px-1 rounded">{result.icd11tm.code}</code> {result.icd11tm.name}
                            </div>
                            <div>
                              <span className="font-medium">ICD-11 Bio:</span>
                              <br />
                              <code className="bg-muted px-1 rounded">{result.icd11bio.code}</code>{" "}
                              {result.icd11bio.name}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* FHIR Integration */}
            {selectedResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    FHIR Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="condition" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="condition">FHIR Condition</TabsTrigger>
                      <TabsTrigger value="bundle">FHIR Bundle</TabsTrigger>
                    </TabsList>

                    <TabsContent value="condition" className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          FHIR Condition resource with cross-system coding for EMR integration
                        </AlertDescription>
                      </Alert>

                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">FHIR Condition Resource</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(mockFHIRCondition, null, 2), "condition")}
                          >
                            {copiedStates.condition ? (
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 mr-2" />
                            )}
                            {copiedStates.condition ? "Copied!" : "Copy JSON"}
                          </Button>
                        </div>
                        <pre className="text-xs overflow-x-auto bg-background p-3 rounded border max-h-64">
                          {JSON.stringify(mockFHIRCondition, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>

                    <TabsContent value="bundle" className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Complete FHIR Bundle ready for EMR system integration</AlertDescription>
                      </Alert>

                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">FHIR Bundle</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(JSON.stringify(generateFHIRBundle(), null, 2), "bundle")}
                            >
                              {copiedStates.bundle ? (
                                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 mr-2" />
                              )}
                              {copiedStates.bundle ? "Copied!" : "Copy JSON"}
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                        <pre className="text-xs overflow-x-auto bg-background p-3 rounded border max-h-64">
                          {JSON.stringify(generateFHIRBundle(), null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 bg-transparent">
                    <Calendar className="w-5 h-5" />
                    <span className="text-xs">Schedule Follow-up</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 bg-transparent">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs">Generate Report</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 bg-transparent">
                    <Code className="w-5 h-5" />
                    <span className="text-xs">Export to EMR</span>
                  </Button>
                  <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-2 bg-transparent">
                    <Search className="w-5 h-5" />
                    <span className="text-xs">Related Conditions</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
