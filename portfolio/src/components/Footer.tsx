import React from "react";
import Link from "next/link";
import { Zap, Mail, Phone, MapPin, CheckCircle2, Heart } from "lucide-react";
import { SiteConfig } from "@/lib/constants";

export function Footer({ site }: { site: SiteConfig }) {
  return (
    <footer className="relative border-t border-slate-800/80 bg-slate-950 text-slate-400 text-xs overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-40 w-3/4 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Col 1: Brand & AEO Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-1.5 shadow-md shadow-emerald-500/20">
                <Zap className="h-5 w-5 text-slate-950 fill-slate-950" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                PosBuzz<span className="text-emerald-400">.</span>
              </span>
            </Link>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              PosBuzz is the modern cloud Point of Sale (POS), real-time multi-branch inventory, and retail store management platform with direct thermal printer agent support.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Systems Operational • 99.99% Cloud SLA</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 text-slate-400">
              <a href="https://twitter.com/PosBuzzApp" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 transition" aria-label="PosBuzz Twitter">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://linkedin.com/company/posbuzz" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 transition" aria-label="PosBuzz LinkedIn">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            </div>
          </div>

          {/* Col 2: Solutions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Solutions</h3>
            <ul className="space-y-2">
              <li><Link href="/solutions#retail-apparel" className="hover:text-emerald-400 transition">Apparel & Boutiques</Link></li>
              <li><Link href="/solutions#restaurants-cafes" className="hover:text-emerald-400 transition">Restaurants & Food Outlets</Link></li>
              <li><Link href="/solutions#supermarket-grocery" className="hover:text-emerald-400 transition">Supermarket & Grocery</Link></li>
              <li><Link href="/solutions#electronics-appliances" className="hover:text-emerald-400 transition">Electronics & Hardware</Link></li>
              <li><Link href="/solutions" className="hover:text-emerald-400 transition">Multi-Branch Chains</Link></li>
            </ul>
          </div>

          {/* Col 3: Product & Hardware */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Platform</h3>
            <ul className="space-y-2">
              <li><Link href="/features#pos-billing" className="hover:text-emerald-400 transition">Cloud POS Billing</Link></li>
              <li><Link href="/features#inventory-batches-serials" className="hover:text-emerald-400 transition">Inventory & Batches</Link></li>
              <li><Link href="/features#multi-branch-transfers" className="hover:text-emerald-400 transition">Multi-Branch Transfers</Link></li>
              <li><Link href="/features#rewards-eod-finance" className="hover:text-emerald-400 transition">Loyalty & Rewards</Link></li>
              <li><Link href="/hardware" className="hover:text-emerald-400 transition">Thermal Printers & Agent</Link></li>
              <li><Link href="/pricing" className="hover:text-emerald-400 transition">Pricing & Tiers</Link></li>
            </ul>
          </div>

          {/* Col 4: Contact & Inquiries */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Contact & Support</h3>
            <div className="space-y-2.5 text-slate-400 text-xs">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <a href={`mailto:${site.contactEmail}`} className="hover:text-white transition">
                  {site.contactEmail}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{site.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{site.address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} PosBuzz Technologies Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-400 transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition">Terms of Service</Link>
            <Link href="/security" className="hover:text-slate-400 transition">Security Overview</Link>
            <Link href="/sitemap.xml" className="hover:text-slate-400 transition">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
