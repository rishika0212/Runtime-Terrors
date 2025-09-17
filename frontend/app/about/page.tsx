import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  Globe,
  Users,
  Target,
  Award,
  Heart,
  Lightbulb,
  Code,
  Database,
  Stethoscope,
  Sparkles,
} from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
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
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-5xl font-serif font-bold text-primary">AYUSetu</h1>
          </div>
          <p className="text-2xl text-muted-foreground text-balance mb-6">Bridging Ancient Wisdom & Global Standards</p>
          <p className="text-lg text-foreground/80 text-pretty max-w-4xl mx-auto leading-relaxed">
            AYUSetu is an innovative platform that seamlessly connects traditional Ayurvedic medicine with modern ICD-11
            medical coding standards, creating a bridge between ancient healing wisdom and contemporary healthcare
            systems.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Target className="w-8 h-8 text-primary" />
                Our Mission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed text-lg">
                To create a comprehensive, accessible platform that enables healthcare professionals and patients to
                understand and utilize the connections between traditional Ayurvedic medicine and modern medical
                classification systems, promoting integrated healthcare approaches.
              </p>
            </CardContent>
          </Card>

          <Card className="border-secondary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Lightbulb className="w-8 h-8 text-secondary-foreground" />
                Our Vision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/90 leading-relaxed text-lg">
                A world where traditional and modern medicine work together harmoniously, where ancient wisdom is
                preserved and integrated with contemporary healthcare standards, making holistic treatment accessible to
                everyone.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Why AYUSetu Matters */}
        <Card className="mb-16 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-serif text-center mb-4">Why AYUSetu Matters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Global Interoperability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Enables traditional medicine practitioners to communicate with modern healthcare systems worldwide
                  using standardized coding.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-secondary-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Preserving Heritage</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Maintains the rich knowledge of traditional medicine while making it accessible and understandable in
                  modern contexts.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-accent-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Patient Empowerment</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Helps patients understand their conditions in both traditional and modern medical terms, promoting
                  informed healthcare decisions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-serif font-bold text-center mb-8">Platform Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Smart Search
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Intelligent search across NAMASTE, ICD-11 TM2, and ICD-11 Biomedicine systems with cross-referencing.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-secondary-foreground" />
                  Interactive Visualization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Dynamic network graphs showing relationships between traditional and modern medical classifications.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-chart-3" />
                  FHIR Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Generate FHIR-compliant resources for seamless integration with modern Electronic Medical Records.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-chart-5" />
                  Patient-Friendly Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Simplified explanations in multiple languages with interactive Q&A for patient education.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-chart-4" />
                  Doctor Workflow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Professional tools for healthcare providers with EMR integration and clinical documentation support.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Comprehensive Browser
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Browse and explore medical codes across all traditional and modern classification systems.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Technical Implementation */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle className="text-2xl font-serif text-center">Technical Excellence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Code className="w-5 h-5 text-primary" />
                  Modern Architecture
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Next.js 15 with App Router for optimal performance
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    TypeScript for type safety and developer experience
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Tailwind CSS for responsive, accessible design
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Interactive data visualizations with D3.js concepts
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-secondary-foreground" />
                  Standards Compliance
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    WHO ICD-11 Traditional Medicine 2 integration
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    FHIR R4 compatibility for healthcare interoperability
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    NAMASTE traditional medicine coding system
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    Multilingual support for global accessibility
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team & Credits */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle className="text-2xl font-serif text-center">Built for SIH Hackathon</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Award className="w-8 h-8 text-primary" />
              <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2">Smart India Hackathon 2024</Badge>
            </div>
            <p className="text-lg text-foreground/90 leading-relaxed max-w-3xl mx-auto mb-6">
              AYUSetu was developed as part of the Smart India Hackathon, addressing the critical need for
              interoperability between traditional and modern healthcare systems. Our solution demonstrates how
              technology can preserve ancient wisdom while enabling global healthcare collaboration.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="outline" className="text-sm">
                Traditional Medicine Integration
              </Badge>
              <Badge variant="outline" className="text-sm">
                Healthcare Interoperability
              </Badge>
              <Badge variant="outline" className="text-sm">
                Patient Education
              </Badge>
              <Badge variant="outline" className="text-sm">
                FHIR Compliance
              </Badge>
              <Badge variant="outline" className="text-sm">
                Multilingual Support
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="text-center border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="p-8">
            <h2 className="text-3xl font-serif font-bold mb-4">Experience AYUSetu Today</h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Explore the seamless integration of traditional and modern medicine. Start your journey towards
              comprehensive healthcare understanding.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/search">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Explore Platform
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 bg-transparent">
                <Link href="/layman">
                  <Users className="w-5 h-5 mr-2" />
                  Patient Mode
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
