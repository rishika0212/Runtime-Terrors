"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Globe, Users, BookOpen, Sparkles } from "lucide-react"
import Link from "next/link"

// Sample Ayurvedic facts for the random fact feature
const ayurvedicFacts = [
  "Ayurveda recognizes three doshas: Vata (air), Pitta (fire), and Kapha (earth) that govern all bodily functions.",
  "The word 'Ayurveda' comes from Sanskrit: 'Ayur' meaning life and 'Veda' meaning knowledge or science.",
  "Turmeric, known as 'Haridra' in Sanskrit, has been used in Ayurveda for over 4,000 years for its healing properties.",
  "Ayurveda emphasizes prevention through lifestyle practices, diet, and herbal remedies tailored to individual constitution.",
  "The ancient text Charaka Samhita, written around 300 BCE, is one of the foundational texts of Ayurvedic medicine.",
]

export default function HomePage() {
  const [currentFact, setCurrentFact] = useState("")
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Set random fact on page load
    const randomFact = ayurvedicFacts[Math.floor(Math.random() * ayurvedicFacts.length)]
    setCurrentFact(randomFact)
    setIsLoaded(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-serif font-bold text-primary">AYUSetu</span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/search" className="text-foreground hover:text-primary transition-colors">
                Explore
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

      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="container mx-auto text-center">
          {/* Animated Spheres */}
          <div className="relative mb-12 h-32">
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="flex items-center justify-center space-x-8">
                {/* AYUSH Sphere */}
                <div
                  className={`w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 pulse-glow ${isLoaded ? "merge-animation" : ""}`}
                >
                  <div className="w-full h-full rounded-full border-2 border-primary-foreground/20 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-primary-foreground" />
                  </div>
                </div>

                {/* ICD-11 Sphere */}
                <div
                  className={`w-20 h-20 rounded-full bg-gradient-to-br from-secondary to-secondary/70 pulse-glow ${isLoaded ? "merge-animation" : ""}`}
                  style={{ animationDelay: "0.5s" }}
                >
                  <div className="w-full h-full rounded-full border-2 border-secondary-foreground/20 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-secondary-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Text */}
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-balance mb-6">
            <span className="text-primary">AYUSetu</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground text-balance mb-8 max-w-3xl mx-auto">
            Bridging Ancient Wisdom & Global Standards
          </p>
          <p className="text-lg text-foreground/80 text-pretty mb-12 max-w-2xl mx-auto leading-relaxed">
            Explore the seamless integration of traditional Ayurvedic medicine with modern ICD-11 medical coding
            standards. Discover, visualize, and understand the connections between ancient healing wisdom and
            contemporary healthcare.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link href="/search">
                <Search className="w-5 h-5 mr-2" />
                Explore Codes
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 bg-transparent">
              <Link href="/visualize">
                <Globe className="w-5 h-5 mr-2" />
                Visualize Mapping
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="text-lg px-8 py-6">
              <Link href="/layman">
                <Users className="w-5 h-5 mr-2" />
                Try Layman Mode
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-4xl font-serif font-bold text-center mb-4 text-balance">Explore the Knowledge Galaxy</h2>
          <p className="text-xl text-muted-foreground text-center mb-16 text-pretty max-w-3xl mx-auto">
            Navigate through interconnected systems of traditional and modern medicine with our interactive tools
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-serif font-semibold mb-4">Smart Search</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Search across NAMASTE, ICD-11 TM2, and ICD-11 Biomedicine systems with intelligent mapping and
                  cross-references
                </p>
              </CardContent>
            </Card>

            <Card className="border-secondary/20 hover:border-secondary/40 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Globe className="w-8 h-8 text-secondary-foreground" />
                </div>
                <h3 className="text-2xl font-serif font-semibold mb-4">Interactive Visualization</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Explore disease relationships through dynamic network graphs showing connections between traditional
                  and modern classifications
                </p>
              </CardContent>
            </Card>

            <Card className="border-accent/20 hover:border-accent/40 transition-colors">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-accent-foreground" />
                </div>
                <h3 className="text-2xl font-serif font-semibold mb-4">For Everyone</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Professional tools for doctors with FHIR integration, plus patient-friendly explanations in multiple
                  languages
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Random Fact Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <Card className="max-w-4xl mx-auto border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-serif font-semibold mb-4 text-primary">Ancient Wisdom</h3>
              <p className="text-lg text-foreground/90 leading-relaxed text-pretty">{currentFact}</p>
              <Button
                variant="outline"
                className="mt-6 bg-transparent"
                onClick={() => {
                  const randomFact = ayurvedicFacts[Math.floor(Math.random() * ayurvedicFacts.length)]
                  setCurrentFact(randomFact)
                }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Another Fact
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-serif font-bold text-primary">AYUSetu</span>
          </div>
          <p className="text-muted-foreground mb-4">Bridging Ancient Wisdom & Global Standards</p>
          <p className="text-sm text-muted-foreground">
            Built for SIH Hackathon • Connecting Traditional Medicine with Modern Healthcare
          </p>
        </div>
      </footer>
    </div>
  )
}
