"use client";

import React, { useState } from "react";
import { Calculator, DollarSign, Clock, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";

export function RoiCalculator({ onOpenDemo }: { onOpenDemo?: () => void }) {
  const [locations, setLocations] = useState<number>(2);
  const [monthlyRevenuePerStore, setMonthlyRevenuePerStore] = useState<number>(35000);
  const [staffPerStore, setStaffPerStore] = useState<number>(4);

  // ROI Formula calculations
  const totalMonthlyRevenue = locations * monthlyRevenuePerStore;
  
  // 1. Shrinkage/stockout reduction (average 2.5% saved on inventory losses)
  const shrinkageSavingsMonthly = totalMonthlyRevenue * 0.024;
  
  // 2. Labor & manual stock-taking savings (each staff saves ~6 hrs/month @ $15/hr)
  const totalStaff = locations * staffPerStore;
  const laborSavingsMonthly = totalStaff * 6 * 16;
  
  // 3. Upselling & Loyalty repeat orders (average 3.5% revenue boost from loyalty & faster turns)
  const revenueBoostMonthly = totalMonthlyRevenue * 0.035;

  const totalMonthlyBenefit = shrinkageSavingsMonthly + laborSavingsMonthly + revenueBoostMonthly;
  const totalAnnualBenefit = totalMonthlyBenefit * 12;

  // Estimated PosBuzz Cost
  const posbuzzAnnualCost = (locations <= 1 ? 29 : locations <= 5 ? 79 : 169) * 12;
  const estimatedRoiRatio = Math.round((totalAnnualBenefit / posbuzzAnnualCost) * 10) / 10;

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
        <Calculator className="h-4 w-4" />
        Interactive Business ROI Calculator
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
        Calculate Your Annual Profit Boost With PosBuzz
      </h2>
      <p className="text-slate-400 text-sm mt-1 max-w-2xl">
        Adjust the sliders below to see how our offline POS, automated stock tracking, and loyalty engine directly expand your bottom line.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 items-center">
        {/* Left Inputs (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sliders */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300 font-medium">Number of Store Outlets / Branches</span>
              <span className="font-bold text-emerald-400 font-mono text-base">{locations} {locations === 1 ? "Store" : "Stores"}</span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="1"
              value={locations}
              onChange={(e) => setLocations(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>1 Store</span>
              <span>10 Stores</span>
              <span>25+ Stores</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300 font-medium">Average Monthly Revenue Per Store</span>
              <span className="font-bold text-emerald-400 font-mono text-base">${monthlyRevenuePerStore.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="5000"
              max="250000"
              step="5000"
              value={monthlyRevenuePerStore}
              onChange={(e) => setMonthlyRevenuePerStore(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>$5,000</span>
              <span>$100,000</span>
              <span>$250,000+</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300 font-medium">Staff Members Per Location</span>
              <span className="font-bold text-emerald-400 font-mono text-base">{staffPerStore} Staff</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={staffPerStore}
              onChange={(e) => setStaffPerStore(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>1 Employee</span>
              <span>10 Employees</span>
              <span>20 Employees</span>
            </div>
          </div>

          {/* Breakdown Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Shrinkage Saved</span>
              </div>
              <div className="mt-1 text-sm font-bold text-white font-mono">
                +${Math.round(shrinkageSavingsMonthly * 12).toLocaleString()}/yr
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-sky-400" />
                <span>Labor Hours Saved</span>
              </div>
              <div className="mt-1 text-sm font-bold text-white font-mono">
                +${Math.round(laborSavingsMonthly * 12).toLocaleString()}/yr
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                <span>Loyalty Upsells</span>
              </div>
              <div className="mt-1 text-sm font-bold text-white font-mono">
                +${Math.round(revenueBoostMonthly * 12).toLocaleString()}/yr
              </div>
            </div>
          </div>
        </div>

        {/* Right Output Card (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <span className="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Estimated Annual Benefit
          </span>

          <div>
            <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 font-mono tracking-tight">
              ${Math.round(totalAnnualBenefit).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Estimated return per year across {locations} {locations === 1 ? "store" : "stores"}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-around text-xs">
            <div>
              <div className="text-slate-400">Est. ROI Ratio</div>
              <div className="font-bold text-emerald-400 font-mono text-base">{estimatedRoiRatio}x ROI</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-slate-400">Payback Period</div>
              <div className="font-bold text-sky-400 font-mono text-base">&lt; 14 Days</div>
            </div>
          </div>

          {onOpenDemo && (
            <button
              onClick={onOpenDemo}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition"
            >
              <span>Claim These Savings</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
