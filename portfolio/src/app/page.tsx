"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Zap, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Boxes, 
  Printer, 
  Building2, 
  Star, 
  ChevronRight,
  Play
} from "lucide-react";
import { SOLUTIONS, CORE_FEATURES, TESTIMONIALS } from "@/lib/constants";
import { PosSimulator } from "@/components/PosSimulator";
import { RoiCalculator } from "@/components/RoiCalculator";
import { FaqSection } from "@/components/FaqSection";
import { DemoModal } from "@/components/DemoModal";

export default function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeSolutionId, setActiveSolutionId] = useState(SOLUTIONS[0].id);

  const activeSolution = SOLUTIONS.find((s) => s.id === activeSolutionId) || SOLUTIONS[0];

  return (
    <div className="space-y-24 sm:space-y-32 pb-24">
      {/* 1. Hero Section */}
      <section className="relative pt-12 sm:pt-20 lg:pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 backdrop-blur-md shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Cloud Point of Sale & Multi-Branch Management</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>

          {/* Main Headline */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
              High-Speed Cloud POS Built for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                Multi-Store Growth & Real-Time Sync
              </span>
            </h1>
            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Ring up sales with sub-second barcode scans, sync inventory across all your branches, manage batch expiry and serial numbers, and print receipts directly through our local thermal printer agent.
            </p>
          </div>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setDemoOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-8 py-4 text-base font-bold text-slate-950 shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition duration-200 active:scale-[0.98]"
            >
              <Sparkles className="h-5 w-5" />
              <span>Book 1-on-1 Guided Demo</span>
            </button>

            <a
              href="#pos-simulator"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-8 py-4 text-base font-semibold text-white hover:bg-slate-800 hover:border-slate-600 transition duration-200"
            >
              <Play className="h-4 w-4 text-emerald-400" />
              <span>Try Interactive Terminal</span>
            </a>
          </div>

          {/* Key Stat Badges */}
          <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="text-2xl font-black text-white font-mono">0.18s</div>
              <div className="text-xs text-slate-400 mt-0.5">Sub-Second Barcode Scan</div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="text-2xl font-black text-emerald-400 font-mono">Multi-MFS</div>
              <div className="text-xs text-slate-400 mt-0.5">bKash, Nagad & Bank Splits</div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="text-2xl font-black text-white font-mono">500+</div>
              <div className="text-xs text-slate-400 mt-0.5">Branches Scalability</div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="text-2xl font-black text-cyan-400 font-mono">99.99%</div>
              <div className="text-xs text-slate-400 mt-0.5">Cloud Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive POS Terminal Simulator Section */}
      <section id="pos-simulator" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Sparkles className="h-4 w-4" /> Live Interactive Sandbox
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Test Drive the PosBuzz Terminal Right Now
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Click products to add to cart, toggle Retail vs Wholesale prices, apply customer reward points, and test thermal receipt printing.
          </p>
        </div>

        <PosSimulator />
      </section>

      {/* 3. Core Architecture Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4" /> Why Retailers Scale With PosBuzz
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Unified Multi-Outlet Store Operations & Live Inventory Control
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                PosBuzz provides seamless management of your branches, supplier bills, customer rewards, quotation conversions, and thermal printers from one central web dashboard.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-white text-sm block">1. Multi-Branch Inventory Transfers:</strong>
                    <span className="text-slate-400">Request and dispatch stock transfers between store locations with live delivery tracking.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-white text-sm block">2. Batch Expiry & Serial Tracking:</strong>
                    <span className="text-slate-400">FEFO batch alerts prevent perishable loss and unique serial tracking simplifies warranty claims.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="text-xs">
                    <strong className="text-white text-sm block">3. Local Thermal Print Agent:</strong>
                    <span className="text-slate-400">Direct HTTP print agent connects web application directly to ESC/POS thermal printers & cash drawers.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Feature Highlights Box */}
            <div className="lg:col-span-6 rounded-2xl border border-slate-700/60 bg-slate-950/80 p-6 space-y-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Platform Workflow Architecture
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-slate-400 font-semibold">⚡ POS & Invoicing</div>
                  <div className="text-emerald-400 font-medium">Barcode scan, MFS bKash/Nagad & split tender</div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-300">
                  <div className="text-slate-400 font-semibold">📦 Multi-Branch Transfers</div>
                  <div className="text-emerald-300 font-medium">Dispatch tracking & destination branch confirmation</div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-300">
                  <div className="text-slate-400 font-semibold">🧾 Thermal Print Agent</div>
                  <div className="text-emerald-300 font-medium">Local HTTP server (Port 8080) for instant ESC/POS cuts</div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-300">
                  <div className="text-slate-400 font-semibold">🔒 Blind EOD Closing</div>
                  <div className="text-emerald-300 font-medium">Tamper-proof shift counts & operational cost logs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Boxes className="h-4 w-4" /> Core Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for Retail, Apparel & Multi-Store Operations
          </h2>
          <p className="text-slate-400 text-sm">
            Everything your cashier, branch managers, and accounting teams need to sell faster and manage stock accurately.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_FEATURES.map((feat) => (
            <div
              key={feat.id}
              className="group rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 sm:p-7 transition-all duration-300 hover:border-emerald-500/40 hover:bg-slate-900/80 hover:-translate-y-1 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                  <Zap className="h-6 w-6" />
                </div>
                {feat.badge && (
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-emerald-400 border border-slate-700">
                    {feat.badge}
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                  {feat.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {feat.tagline}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
                {feat.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>Explore Full Feature Matrix & Specifications</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 5. Industry Solutions Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Building2 className="h-4 w-4" /> Tailored Industry Workflows
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tailored For Your Specific Retail Workflow
          </h2>
          <p className="text-slate-400 text-sm">
            Whether you sell apparel with size-color matrices, manage a grocery store with batch expiry, or sell electronics with serial warranties.
          </p>
        </div>

        {/* Industry Tabs */}
        <div className="flex flex-wrap justify-center gap-3">
          {SOLUTIONS.map((sol) => (
            <button
              key={sol.id}
              onClick={() => setActiveSolutionId(sol.id)}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                activeSolutionId === sol.id
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold"
                  : "bg-slate-900/80 border border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{sol.title}</span>
            </button>
          ))}
        </div>

        {/* Active Solution Detail Card */}
        <div className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-6 sm:p-10 backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                {activeSolution.badge}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white">
                {activeSolution.title}
              </h3>
              <div className="text-emerald-400 text-sm font-medium">
                {activeSolution.subtitle}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {activeSolution.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
                {activeSolution.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button
                  onClick={() => setDemoOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:from-emerald-400 hover:to-teal-300 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>See {activeSolution.title} Demo</span>
                </button>
                <Link
                  href="/solutions"
                  className="text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1"
                >
                  <span>Learn more</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Metric Highlight */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 space-y-4 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider">
                Proven Real-World Impact
              </div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 font-mono">
                {activeSolution.metrics.value}
              </div>
              <div className="text-sm font-semibold text-white">
                {activeSolution.metrics.label}
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-left">
                {activeSolution.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Interactive ROI Savings Calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <RoiCalculator onOpenDemo={() => setDemoOpen(true)} />
      </section>

      {/* 7. Testimonials & Social Proof */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Star className="h-4 w-4 fill-emerald-400 text-emerald-400" /> Customer Success Stories
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Trusted by Multi-Branch Retailers & High-Velocity Stores
          </h2>
          <p className="text-slate-400 text-sm">
            Read why store managers, owners, and operations heads rely on PosBuzz every day.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-1 text-emerald-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-emerald-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-300 italic leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{t.author}</div>
                  <div className="text-xs text-slate-400">{t.role}</div>
                  <div className="text-[11px] text-emerald-400/90 font-medium">{t.company}</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-mono font-bold text-emerald-300">
                  {t.metrics}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Comprehensive FAQ & AEO Knowledge Engine */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Frequently Asked Questions
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Everything You Need to Know About PosBuzz
          </h2>
          <p className="text-slate-400 text-sm">
            Search or filter below to find direct answers regarding the local printer agent, hardware support, multi-branch syncing, and MFS payments.
          </p>
        </div>

        <FaqSection />
      </section>

      {/* 9. Bottom High-Converting Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-8 sm:p-12 lg:p-16 text-center shadow-2xl">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
              <Sparkles className="h-4 w-4" /> Ready to Upgrade Your Store Operations?
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Start Your 14-Day Free Trial or Book a Live Demo Today
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              No credit card required. Migrate your existing product catalog in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setDemoOpen(true)}
                className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-8 py-4 text-base font-bold text-slate-950 shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition duration-200"
              >
                Schedule Live 1-on-1 Walkthrough
              </button>

              <Link
                href="/pricing"
                className="w-full sm:w-auto rounded-2xl border border-slate-700 bg-slate-900/80 px-8 py-4 text-base font-semibold text-white hover:bg-slate-800 transition duration-200"
              >
                View Plans & Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Modal */}
      <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
