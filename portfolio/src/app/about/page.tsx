import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { 
  Zap, 
  ShieldCheck, 
  Target, 
  Users, 
  Globe, 
  Award, 
  ArrowRight,
  HeartHandshake,
  Cpu
} from "lucide-react";
import { getPortfolioContent } from "@/lib/api";

export const metadata: Metadata = {
  title: "About PosBuzz | Next-Gen Cloud POS & Retail Cloud ERP",
  description: "PosBuzz is on a mission to modernize brick-and-mortar retail and hospitality with offline-native cloud POS, multi-branch automation, and open hardware ecosystems.",
};

export default async function AboutPage() {
  const { site } = await getPortfolioContent();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
          <Zap className="h-4 w-4" /> Our Mission
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Modernizing Retail Infrastructure For The Real World
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          We believe store owners should spend time delighting customers and expanding branches — not fighting slow proprietary POS hardware, confusing spreadsheets, or network outages.
        </p>
      </div>

      {/* Core Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Reliability Above All</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every millisecond matters when lines form at your counter. Our offline-first architecture guarantees you never lose a sale during internet brownouts.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Cpu className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Open Hardware Freedom</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            We reject predatory proprietary hardware lock-in. PosBuzz connects to standard thermal printers, barcode scanners, and scales you already own.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">White-Glove Support</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            From free catalog migration to 24/7 priority support, our team ensures your cashiers and store managers are never left in the dark.
          </p>
        </div>
      </div>

      {/* Security & Reliability */}
      <div className="rounded-3xl border border-slate-700/80 bg-slate-950 p-6 sm:p-12 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-4 w-4" /> Enterprise Security
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Bank-Grade Encryption & Tamper-Proof Audit Trails
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              PosBuzz is engineered with end-to-end TLS 1.3 encryption, role-based access control (RBAC), and automated database snapshots. Your sales ledgers, customer numbers, and cash reconciliation totals are safeguarded at every step.
            </p>
            <div className="pt-2 flex flex-wrap gap-3 text-xs">
              <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300">✓ SOC2 Type II Certified Data Centers</span>
              <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300">✓ PCI-DSS Level 1 Compliant Payments</span>
              <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-slate-300">✓ 99.99% Guaranteed Cloud Uptime</span>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Direct Contact Channels</div>
            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <strong className="text-white block">Email Support:</strong>
                <a href={`mailto:${site.contactEmail}`} className="text-emerald-400 hover:underline">{site.contactEmail}</a>
              </div>
              <div>
                <strong className="text-white block">Sales & Enterprise Partnerships:</strong>
                <a href={`mailto:${site.salesEmail}`} className="text-emerald-400 hover:underline">{site.salesEmail}</a>
              </div>
              <div>
                <strong className="text-white block">Developer & GitHub Repository:</strong>
                <a href="https://github.com/PosBuzz" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">https://github.com/PosBuzz</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
