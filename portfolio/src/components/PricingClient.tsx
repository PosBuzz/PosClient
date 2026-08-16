"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PricingPlan } from "@/lib/constants";
import { Check, X, Sparkles, HelpCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { DemoModal } from "@/components/DemoModal";

export function PricingClient({ plans }: { plans: PricingPlan[] }) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);

  const comparisonCategories = [
    {
      category: "POS Terminal & Selling",
      rows: [
        { name: "POS Registers Included", starter: "2 Registers", pro: "Unlimited (Per store)", enterprise: "Unlimited" },
        { name: "Offline-First Engine", starter: true, pro: true, enterprise: true },
        { name: "Barcode Scanning & Label Printing", starter: true, pro: true, enterprise: true },
        { name: "Split Payments (Cash/Card/MFS)", starter: true, pro: true, enterprise: true },
        { name: "Quotations & 1-Click Sale Conversion", starter: true, pro: true, enterprise: true },
      ]
    },
    {
      category: "Inventory & Multi-Branch",
      rows: [
        { name: "Maximum Product SKUs", starter: "5,000 SKUs", pro: "Unlimited", enterprise: "Unlimited (500k+)" },
        { name: "Multi-Store Branches", starter: "1 Store", pro: "Up to 5 (Scalable)", enterprise: "Unlimited Outlets" },
        { name: "Inter-Branch Stock Transfers", starter: false, pro: true, enterprise: true },
        { name: "Batch Expiry (FEFO) & Serials", starter: false, pro: true, enterprise: true },
        { name: "Vendor Purchase Payments & Bills", starter: true, pro: true, enterprise: true },
      ]
    },
    {
      category: "Customer Loyalty & Analytics",
      rows: [
        { name: "Points-Per-Spend Loyalty Program", starter: false, pro: true, enterprise: true },
        { name: "SMS / Email Digital Receipts", starter: "Standard", pro: "Branded", enterprise: "Custom Domain" },
        { name: "Blind EOD Cash Drawer Audit", starter: true, pro: true, enterprise: true },
        { name: "Daily Sales Targets & Leaderboards", starter: false, pro: true, enterprise: true },
        { name: "Operational Costs & Profit Tracking", starter: true, pro: true, enterprise: true },
      ]
    },
    {
      category: "Support & Infrastructure",
      rows: [
        { name: "Role-Based Access Control (RBAC)", starter: "Basic", pro: "Advanced", enterprise: "Custom Granular" },
        { name: "Support Channels", starter: "Email & Chat (24/5)", pro: "Priority 24/7 Phone/Chat", enterprise: "Dedicated SLA Architect" },
        { name: "Data Migration Assistance", starter: "Self-service CSV", pro: "Free Managed Migration", enterprise: "Full White-Glove" },
        { name: "Cloud SLA Uptime", starter: "99.9%", pro: "99.95%", enterprise: "99.99% Guaranteed" },
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
          <Sparkles className="h-4 w-4" /> Transparent, Predictable Pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Simple Plans for Single Stores & Multi-Branch Chains
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          No hidden transaction surcharges. No forced hardware leases. Pick the plan that fits your retail footprint and scale anytime.
        </p>

        {/* Monthly / Annual Billing Switcher */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${!isAnnual ? "text-white" : "text-slate-400"}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative h-7 w-14 rounded-full bg-slate-800 p-1 border border-slate-700 transition focus:outline-none"
            aria-label="Toggle Annual Billing"
          >
            <div
              className={`h-5 w-5 rounded-full bg-emerald-400 shadow-md transition-transform duration-200 ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold ${isAnnual ? "text-white" : "text-slate-400"}`}>
              Annual Billing
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
              Save 20%
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const price = isAnnual ? plan.priceAnnualMonthly : plan.priceMonthly;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-8 transition-all duration-300 ${
                plan.popular
                  ? "border-2 border-emerald-500 bg-slate-900/90 shadow-2xl shadow-emerald-500/10 lg:-translate-y-2"
                  : "border border-slate-800 bg-slate-900/40 hover:border-slate-700"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-1 text-xs font-bold text-slate-950 shadow-md">
                  {plan.badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-white font-mono">${price}</span>
                  <span className="text-xs text-slate-400">/ month {isAnnual ? "(billed annually)" : ""}</span>
                </div>

                <button
                  onClick={() => setDemoOpen(true)}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    plan.popular
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-300"
                      : "bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                <div className="pt-4 border-t border-slate-800 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Features Included:</div>
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}

                  {plan.notIncluded && (
                    <div className="pt-2 space-y-2">
                      {plan.notIncluded.map((nf, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                          <X className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                          <span>{nf}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 text-center text-[11px] text-slate-500">
                14-day risk-free trial • Cancel anytime
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Feature Comparison Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Full Feature Comparison Matrix</h2>
          <p className="text-xs text-slate-400">Detailed breakdown of capabilities across all tiers.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-4 px-4 font-semibold text-sm text-white w-1/3">Capability</th>
                <th className="py-4 px-4 font-semibold text-sm text-slate-300 text-center">Starter</th>
                <th className="py-4 px-4 font-semibold text-sm text-emerald-400 text-center">Professional</th>
                <th className="py-4 px-4 font-semibold text-sm text-sky-400 text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparisonCategories.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  <tr className="bg-slate-900/60 border-y border-slate-800/80">
                    <td colSpan={4} className="py-2.5 px-4 font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                      {group.category}
                    </td>
                  </tr>
                  {group.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-900 hover:bg-slate-900/40">
                      <td className="py-3 px-4 text-slate-300 font-medium">{row.name}</td>
                      
                      <td className="py-3 px-4 text-center text-slate-400">
                        {typeof row.starter === "boolean" ? (
                          row.starter ? <Check className="h-4 w-4 text-emerald-400 mx-auto" /> : <X className="h-4 w-4 text-slate-600 mx-auto" />
                        ) : (
                          row.starter
                        )}
                      </td>

                      <td className="py-3 px-4 text-center text-slate-200 font-medium">
                        {typeof row.pro === "boolean" ? (
                          row.pro ? <Check className="h-4 w-4 text-emerald-400 mx-auto" /> : <X className="h-4 w-4 text-slate-600 mx-auto" />
                        ) : (
                          row.pro
                        )}
                      </td>

                      <td className="py-3 px-4 text-center text-slate-200 font-medium">
                        {typeof row.enterprise === "boolean" ? (
                          row.enterprise ? <Check className="h-4 w-4 text-sky-400 mx-auto" /> : <X className="h-4 w-4 text-slate-600 mx-auto" />
                        ) : (
                          row.enterprise
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
