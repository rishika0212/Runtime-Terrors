"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0b0f19] via-[#0b0f19] to-black text-white overflow-hidden">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-80 w-80 rounded-full bg-yellow-500/10 blur-3xl" />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40"
          aria-hidden
        />
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10">
        <div className="grid w-full items-center gap-10 md:grid-cols-2">
          {/* Left: Logo (kept prominent) */}
          <div className="flex justify-center md:justify-end">
            <Image
              src="/images/ayusetu_logo.png"
              alt="AYUSetu Logo"
              width={740}
              height={740}
              className="h-auto w-[44vw] max-w-[560px] min-w-[240px] object-contain"
              priority
            />
          </div>

          {/* Right: Tagline + Buttons */}
          <div className="flex flex-col items-center space-y-7 text-center md:items-start md:text-left">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-cyan-400 bg-clip-text text-transparent">
                Bridging Ancient Wisdom
              </span>
              <br />
              with Modern Science
              <span className="text-yellow-300">.</span>
            </h1>

            <p className="max-w-xl text-base text-white/70 md:text-lg">
              Explore standardized mappings across AYUSH systems and ICD-11. Search, compare,
              and visualize terminology relationships — all in one place.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 px-8 text-black hover:opacity-90"
              >
                <Link href="/login">Login</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 px-8 text-black hover:opacity-90"
              >
                <Link href="/register">Register</Link>
              </Button>

            </div>


          </div>
        </div>
      </main>
    </div>
  )
}