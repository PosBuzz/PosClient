import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CORE_FEATURES } from "@/lib/constants";
import { 
  Zap, 
  Boxes, 
  Building2, 
  Sparkles, 
  Printer, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  Database,
  Lock,
  Cpu,
  Layers
} from "lucide-react";

export const metadata: Metadata = {
  title: "POS Features & Architecture Matrix | PosBuzz",
  description: "Complete overview of PosBuzz active modules: High-speed POS billing, multi-branch stock transfers, batch expiry & serial numbers, quotations, customer loyalty rewards, and thermal printer bridge.",
};

export default function FeaturesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
          <Boxes className="h-4 w-4" /> Core Platform Capabilities
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Everything You Need to Run & Scale Your Stores
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          From the front-line cashier register to the multi-branch central HQ dashboard, every module is engineered for maximum speed, accuracy, and audit security.
        </p>
      </div>

      {/* Feature Deep Dive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {CORE_FEATURES.map((feat) => (
          <div
            key={feat.id}
            id={feat.id}
            className="scroll-mt-28 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-6 hover:border-emerald-500/40 transition duration-300 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Zap className="h-6 w-6" />
              </div>
              {feat.badge && (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-emerald-400 border border-slate-700">
                  {feat.badge}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">{feat.title}</h2>
              <div className="text-sm text-emerald-400/90 font-medium">{feat.tagline}</div>
              <p className="text-xs text-slate-300 leading-relaxed pt-1">{feat.description}</p>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module Highlights</div>
              {feat.highlights.map((h, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Technical Architecture Matrix */}
      <div className="rounded-3xl border border-slate-700/80 bg-slate-950 p-6 sm:p-10 space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Under The Hood: PosBuzz Stack Architecture</h2>
          <p className="text-xs text-slate-400">
            Enterprise reliability built on NestJS, PostgreSQL, Redis, RabbitMQ, and React/Next.js.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">PostgreSQL & Prisma</h3>
            <p className="text-xs text-slate-400">ACID-compliant transactions for faultless inventory ledgers and financial audit logs.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Redis In-Memory Cache</h3>
            <p className="text-xs text-slate-400">Sub-10ms response times for barcode lookups, daily target counters, and session authentication.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">RabbitMQ Event Broker</h3>
            <p className="text-xs text-slate-400">Asynchronous background workers for receipt printing queues, SMS triggers, and cloud sync.</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Role-Based RBAC & SOC2</h3>
            <p className="text-xs text-slate-400">Granular permissions protecting sensitive financial data, discounts, and managerial overrides.</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Ready to explore PosBuzz for your stores?</h2>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-xs font-bold text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-300 transition"
        >
          <span>Book a Platform Walkthrough</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
