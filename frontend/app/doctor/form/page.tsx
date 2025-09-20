"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

import { apiPost, apiGet } from "@/lib/api"
import { Loader2, Search, UserPlus } from "lucide-react"

// Types for concept map results
type ConceptMapItem = {
  source_system: string
  source_code: string
  source_display?: string
  target_system: string
  target_code: string
  target_display?: string
  mapping_type: string
  confidence?: number | null
}

// Validation schema
const formSchema = z.object({
  patient_name: z.string().min(2, "Name is required"),
  abha_id: z
    .string()
    .min(1, "ABHA is required")
    .refine((v) => v.replace(/\D/g, "").length === 14, {
      message: "Enter a valid 14-digit ABHA number (e.g., 91-2542-1310-7033)",
    }),
  age: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return undefined
      const n = typeof v === "number" ? v : Number(v)
      return Number.isFinite(n) ? n : undefined
    })
    .refine((v) => v === undefined || (v >= 0 && v <= 120), {
      message: "Age must be between 0 and 120",
    }),
  sex: z.enum(["Male", "Female", "Other"]).optional(),
  diagnosis: z.string().min(2, "Diagnosis is required"),
})

// Helper to format ABHA live as 91-2542-1310-7033
const formatAbha = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 14)
  const parts = [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10), digits.slice(10, 14)].filter(Boolean)
  return parts.join("-")
}

export default function NewPatientForm() {
  const router = useRouter()

  // Search state
  const [searching, setSearching] = useState(false)
  const [options, setOptions] = useState<ConceptMapItem[]>([])
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<ConceptMapItem | null>(null)
  const [searchDone, setSearchDone] = useState(false)

  // Submit state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      patient_name: "",
      abha_id: "",
      age: undefined,
      sex: undefined,
      diagnosis: "",
    },
  })

  const abhaValue = form.watch("abha_id")
  const abhaDigits = useMemo(() => abhaValue.replace(/\D/g, ""), [abhaValue])
  const isValidAbha = abhaDigits.length === 14

  const handleDiagnosisSearch = async () => {
    const diagnosis = form.getValues("diagnosis")
    if (!diagnosis) return
    setSearching(true)
    try {
      const resp = await apiGet<{ items: ConceptMapItem[] }>(
        `/conceptmaps?search=${encodeURIComponent(diagnosis)}&limit=10&offset=0`
      )
      setOptions(resp.items || [])
      setSelectedDiagnosis(null)
      setSearchDone(true)
    } catch {
      setOptions([])
      setSearchDone(true)
    } finally {
      setSearching(false)
    }
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true)
    setError(null)

    try {
      const tok = typeof window !== "undefined" ? localStorage.getItem("token") || undefined : undefined

      // Persist ABHA locally so Patient page can query Conditions with the same reference
      if (typeof window !== "undefined") {
        localStorage.setItem("abha_id", values.abha_id.replace(/\D/g, ""))
      }

      await apiPost(
        "/patient-forms/",
        {
          patient_name: values.patient_name,
          age: values.age,
          sex: values.sex,
          abha_id: values.abha_id.replace(/\D/g, ""),
          diagnosis: selectedDiagnosis
            ? selectedDiagnosis.target_display || selectedDiagnosis.source_display || values.diagnosis
            : values.diagnosis,
          // Persist mapping to mark as Mapped in the patients list
          icd_system: selectedDiagnosis ? selectedDiagnosis.target_system : undefined,
          icd_code: selectedDiagnosis ? selectedDiagnosis.target_code : undefined,
        },
        tok
      )

      // Also create a FHIR Condition via Bundle so the patient dashboard can show it
      try {
        const codings: any[] = []
        if (selectedDiagnosis) {
          // Include both source (e.g., NAMASTE) and target (e.g., ICD-11) codings
          codings.push({
            system: selectedDiagnosis.source_system,
            code: selectedDiagnosis.source_code,
            display: selectedDiagnosis.source_display || undefined,
          })
          codings.push({
            system: selectedDiagnosis.target_system,
            code: selectedDiagnosis.target_code,
            display: selectedDiagnosis.target_display || undefined,
          })
        }
        const doctorAbha = typeof window !== "undefined" ? localStorage.getItem("doctor_abha_id") || undefined : undefined
        const bundle = {
          resourceType: "Bundle",
          type: "transaction",
          entry: [
            {
              resource: {
                resourceType: "Condition",
                subject: { reference: `Patient/${values.abha_id.replace(/\D/g, "")}` }, // Uses patient ABHA digits as Patient ID
                asserter: doctorAbha ? { reference: `Practitioner/${doctorAbha}` } : undefined,
                code: {
                  text: values.diagnosis,
                  coding: codings,
                },
              },
            },
          ],
        }
        await apiPost("/fhir/Bundle", bundle)
      } catch (e) {
        // Non-fatal for the UX; the patient record is still created
        console.warn("FHIR Bundle ingest failed:", e)
      }

      router.push("/doctor?view=patients")
    } catch (err: any) {
      setError(err?.message || "Failed to create patient")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <Card className="w-full max-w-4xl shadow-sm bg-card text-foreground border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <UserPlus className="w-5 h-5 text-primary" />
            New Patient
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Patient Name */}
              <FormField
                control={form.control}
                name="patient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormDescription>Provide the patient’s full legal name.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ABHA ID */}
              <FormField
                control={form.control}
                name="abha_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ABHA ID</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        maxLength={17}
                        placeholder="91-2542-1310-7033"
                        value={field.value}
                        onChange={(e) => field.onChange(formatAbha(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>14 digits, auto-formatted as you type.</FormDescription>
                    <FormMessage />
                    {!isValidAbha && abhaValue.length > 0 ? (
                      <p className="text-red-400 text-sm mt-1">
                        Enter a valid 14-digit ABHA number (e.g., 91-2542-1310-7033).
                      </p>
                    ) : null}
                  </FormItem>
                )}
              />

              {/* Age & Sex */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={120}
                          placeholder="e.g., 32"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormDescription>Optional. Range: 0 – 120.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sex</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Optional.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Diagnosis */}
              <FormField
                control={form.control}
                name="diagnosis"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <FormLabel htmlFor="diagnosis">Diagnosis</FormLabel>
                        <FormControl>
                          <Input id="diagnosis" placeholder="Type to search..." {...field} />
                        </FormControl>
                        <FormDescription>Search to map with standardized concepts.</FormDescription>
                        <FormMessage />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleDiagnosisSearch}
                        disabled={searching || !field.value}
                        className="mt-6"
                      >
                        {searching ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-1" /> Search
                          </>
                        )}
                      </Button>
                    </div>
                  </FormItem>
                )}
              />

              {/* Results Table */}
              {searchDone && (
                <div className="mt-4 border border-gray-800 rounded-md">
                  {options.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-card">
                          <TableHead>Source</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Source Display</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Target Display</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead className="text-center">Select</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {options.map((m, idx) => {
                          const selected = selectedDiagnosis === m
                          return (
                            <TableRow
                              key={idx}
                              className={`${selected ? "bg-yellow-500/20 text-yellow-100" : "hover:bg-gray-800/60"} cursor-pointer`}
                              onClick={() => setSelectedDiagnosis(m)}
                            >
                              <TableCell className="font-medium">{m.source_system}</TableCell>
                              <TableCell>
                                <code className="px-1 py-0.5 rounded bg-gray-800 text-gray-100 border border-gray-700">{m.source_code}</code>
                              </TableCell>
                              <TableCell className="max-w-[260px] truncate" title={m.source_display || ""}>
                                {m.source_display}
                              </TableCell>
                              <TableCell className="font-medium">{m.target_system}</TableCell>
                              <TableCell>
                                <code className="px-1 py-0.5 rounded bg-gray-800 text-gray-100 border border-gray-700">{m.target_code}</code>
                              </TableCell>
                              <TableCell className="max-w-[260px] truncate" title={m.target_display || ""}>
                                {m.target_display}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{m.mapping_type}</Badge>
                              </TableCell>
                              <TableCell>{m.confidence ?? "-"}</TableCell>
                              <TableCell className="text-center">{selected ? "✅" : ""}</TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow
                          className={`${selectedDiagnosis === null ? "bg-yellow-500/20 text-yellow-100" : ""} cursor-pointer hover:bg-gray-800/60`}
                          onClick={() => setSelectedDiagnosis(null)}
                        >
                          <TableCell colSpan={9} className="text-center">
                            None matches
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-400 p-4">No matches found.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => router.push("/doctor")}>Cancel</Button>
                <Button type="submit" disabled={!isValidAbha || loading || !form.formState.isValid}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Patient"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}