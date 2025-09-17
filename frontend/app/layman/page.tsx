"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, MessageCircle, Heart, Leaf, Globe, Search, Volume2, HelpCircle, Sparkles, Users } from "lucide-react"
import Link from "next/link"

// Mock data for patient-friendly explanations
const simpleExplanations = [
  {
    id: "jwara",
    traditional: "Jwara",
    simple: "Fever",
    description: "When your body temperature goes up higher than normal, making you feel hot and sometimes shivery",
    symptoms: ["Feeling hot", "Sweating", "Chills", "Headache", "Body aches"],
    remedies: ["Rest and drink plenty of water", "Light, easy-to-digest food", "Cool compress on forehead"],
    icon: "🌡️",
  },
  {
    id: "amavata",
    traditional: "Amavata",
    simple: "Joint Pain",
    description: "Pain and stiffness in your joints (like knees, hands, or shoulders) that makes it hard to move",
    symptoms: ["Joint pain", "Stiffness", "Swelling", "Difficulty moving"],
    remedies: ["Gentle exercise", "Warm oil massage", "Anti-inflammatory herbs like turmeric"],
    icon: "🦴",
  },
  {
    id: "kasa",
    traditional: "Kasa",
    simple: "Cough",
    description: "When you keep coughing to clear your throat or chest, sometimes with mucus",
    symptoms: ["Persistent coughing", "Throat irritation", "Chest congestion", "Mucus production"],
    remedies: ["Honey and ginger tea", "Steam inhalation", "Avoid cold foods and drinks"],
    icon: "🫁",
  },
  {
    id: "atisara",
    traditional: "Atisara",
    simple: "Loose Motions",
    description: "When you have watery or loose bowel movements more often than usual",
    symptoms: ["Loose stools", "Frequent bathroom visits", "Stomach cramps", "Dehydration"],
    remedies: ["Drink lots of fluids", "Eat simple foods like rice and yogurt", "Avoid spicy foods"],
    icon: "🍚",
  },
]

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "hi", name: "हिंदी (Hindi)", flag: "🇮🇳" },
  { code: "ta", name: "தமிழ் (Tamil)", flag: "🇮🇳" },
  { code: "kn", name: "ಕನ್ನಡ (Kannada)", flag: "🇮🇳" },
  { code: "sa", name: "संस्कृत (Sanskrit)", flag: "🇮🇳" },
]

const chatMessages = [
  {
    id: 1,
    type: "bot",
    message:
      "Hello! I'm here to help you understand traditional medicine terms in simple language. What would you like to know about?",
  },
]

export default function LaymanPage() {
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCondition, setSelectedCondition] = useState<any>(null)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState(chatMessages)
  const [isTyping, setIsTyping] = useState(false)

  const filteredConditions = simpleExplanations.filter(
    (condition) =>
      condition.traditional.toLowerCase().includes(searchTerm.toLowerCase()) ||
      condition.simple.toLowerCase().includes(searchTerm.toLowerCase()) ||
      condition.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return

    const userMessage = {
      id: messages.length + 1,
      type: "user" as const,
      message: chatInput,
    }

    setMessages([...messages, userMessage])
    setChatInput("")
    setIsTyping(true)

    // Simulate bot response
    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        type: "bot" as const,
        message: `I understand you're asking about "${chatInput}". Let me help you with that! Based on traditional medicine, this could be related to several conditions. Would you like me to explain any specific symptoms you're experiencing?`,
      }
      setMessages((prev) => [...prev, botResponse])
      setIsTyping(false)
    }, 2000)
  }

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = selectedLanguage === "hi" ? "hi-IN" : "en-US"
      speechSynthesis.speak(utterance)
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
              <Link href="/doctor" className="text-foreground hover:text-primary transition-colors">
                For Doctors
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold mb-4 text-balance">Patient-Friendly Mode</h1>
          <p className="text-xl text-muted-foreground text-pretty max-w-3xl mx-auto">
            Understanding traditional medicine in simple, everyday language
          </p>
        </div>

        {/* Language Selector */}
        <div className="max-w-md mx-auto mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary" />
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          {lang.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Search and Browse */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search Health Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Search for symptoms or conditions (e.g., 'fever', 'joint pain')..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-lg py-6"
                />
              </CardContent>
            </Card>

            {/* Condition Cards */}
            <div className="grid gap-4">
              {filteredConditions.map((condition) => (
                <Card
                  key={condition.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedCondition?.id === condition.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedCondition(condition)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{condition.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-serif font-semibold">{condition.simple}</h3>
                          <Badge variant="outline" className="text-xs">
                            {condition.traditional}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              speakText(condition.description)
                            }}
                          >
                            <Volume2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-foreground/80 leading-relaxed">{condition.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed View */}
            {selectedCondition && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-3xl">{selectedCondition.icon}</span>
                    <div>
                      <h2 className="text-2xl font-serif">{selectedCondition.simple}</h2>
                      <Badge className="bg-primary text-primary-foreground mt-1">
                        Traditional: {selectedCondition.traditional}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-primary" />
                      What is it?
                    </h3>
                    <p className="text-foreground/90 leading-relaxed text-lg">{selectedCondition.description}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      Common Symptoms
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedCondition.symptoms.map((symptom: string, index: number) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          <span>{symptom}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Leaf className="w-5 h-5 text-green-500" />
                      Natural Remedies
                    </h3>
                    <div className="space-y-2">
                      {selectedCondition.remedies.map((remedy: string, index: number) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded"
                        >
                          <Sparkles className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-green-800 dark:text-green-200">{remedy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Chat Assistant */}
          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Ask Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Chat Messages */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.type === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.message}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted text-foreground p-3 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask about symptoms or conditions..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleChatSubmit()}
                      className="flex-1"
                    />
                    <Button onClick={handleChatSubmit} disabled={!chatInput.trim()}>
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Tips */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Health Tips for Everyone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Listen to Your Body</h3>
                <p className="text-sm text-muted-foreground">
                  Pay attention to what your body tells you. Early signs can help prevent bigger problems.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Leaf className="w-8 h-8 text-secondary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Natural Balance</h3>
                <p className="text-sm text-muted-foreground">
                  Traditional medicine focuses on balancing your body naturally with food, herbs, and lifestyle.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Ask for Help</h3>
                <p className="text-sm text-muted-foreground">
                  Don't hesitate to consult healthcare providers who understand both traditional and modern medicine.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
