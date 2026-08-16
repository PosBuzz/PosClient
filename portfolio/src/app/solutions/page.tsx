import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolioContent } from "@/lib/api";
import { 
  ShoppingBag, 
  Utensils, 
  Store, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Layers,
  Zap,
  Boxes
} from "lucide-react";

export const metadata: Metadata = {
  title: "Industry POS Solutions | Retail, Restaurant, Supermarket & Pharmacy",
  description: "Explore tailored Point of Sale and ERP solutions engineered for apparel boutiques, restaurants, cafes, supermarkets, pharmacies, and enterprise retail chains.",
};

export default async function SolutionsPage() {
  const { solutions } = await getPortfolioContent();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
          <Layers className="h-4 w-4" /> Tailored Industry Blueprints
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Purpose-Built POS Solutions For Your Industry
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          From fast-paced quick service cafes to multi-variant fashion boutiques and high-traffic grocery supermarkets, PosBuzz adapts to your operational reality.
        </p>
      </div>

      {/* Solutions Detailed List */}
      <div className="space-y-16">
        {solutions.map((sol, index) => {
          const isEven = index % 2 === 0;
          return (
            <div
              key={sol.id}
              id={sol.id}
              className="scroll-mt-28 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-10 lg:p-12 backdrop-blur-xl"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Text Content */}
                <div className={`lg:col-span-7 space-y-5 ${isEven ? "" : "lg:order-2"}`}>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    {sol.badge}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {sol.title}
                  </h2>
                  <div className="text-emerald-400 font-medium text-sm">
                    {sol.subtitle}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {sol.description}
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Key Tailored Features
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sol.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-200">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex flex-wrap items-center gap-4">
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-xs font-bold text-slate-950 shadow-md hover:from-emerald-400 hover:to-teal-300 transition"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Get Custom {sol.title} Demo</span>
                    </Link>
                  </div>
                </div>

                {/* Right Card / Metrics */}
                <div className={`lg:col-span-5 ${isEven ? "" : "lg:order-1"}`}>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-950/80 p-6 sm:p-8 space-y-6 text-center shadow-xl">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Performance Benchmark
                    </div>
                    <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 font-mono">
                      {sol.metrics.value}
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {sol.metrics.label}
                    </div>

                    <div className="pt-4 border-t border-slate-800 space-y-2.5 text-left text-xs">
                      {sol.benefits.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2 text-slate-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise Custom Banner */}
      <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-12 text-center space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Need a Custom Architecture for 50+ Stores?
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
          We provide dedicated enterprise database clustering, on-premise container deployment, and ERP webhook integration.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
        >
          <span>Speak With an Enterprise Architect</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
