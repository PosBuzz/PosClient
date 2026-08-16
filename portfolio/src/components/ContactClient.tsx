"use client";

import React, { useState } from "react";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  Clock, 
  MessageSquare, 
  HelpCircle 
} from "lucide-react";
import { SiteConfig } from "@/lib/constants";

export function ContactClient({ site }: { site: SiteConfig }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    stores: "1",
    message: "",
    industry: "retail",
    // Honeypot: hidden from real users, filled in by bots.
    companyWebsite: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CONTACT",
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          business_name: formData.businessName,
          industry: formData.industry,
          locations: formData.stores,
          message: formData.message,
          source_page: "/contact",
          company_website: formData.companyWebsite
        })
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please email us directly and we'll pick it up right away.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
          <Mail className="h-4 w-4" /> Get in Touch
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Let’s Talk About Scaling Your Retail Operations
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Have a question about hardware compatibility, need help migrating your catalog, or want to schedule a custom demo? Our team is here to assist.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Form (7 Cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-10 backdrop-blur-xl">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-bounce">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Message Received!</h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Thank you, <span className="font-semibold text-emerald-400">{formData.name}</span>! Our retail technical team will get back to you at <span className="text-emerald-400">{formData.email}</span> within 2 hours.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
              >
                Send Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1 mb-4">
                <h2 className="text-xl font-bold text-white">Send Us a Direct Inquiry</h2>
                <p className="text-xs text-slate-400">Fill out this quick form and we’ll respond with tailored recommendations.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Istiak Tashrif"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@yourstore.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Store / Business Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Urban Threads Retail"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    required
                    placeholder="+880 1XXX-XXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Industry Type</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="retail">Apparel & Fashion Boutique</option>
                    <option value="restaurant">Restaurant, Cafe & Bar</option>
                    <option value="supermarket">Supermarket & Grocery</option>
                    <option value="pharmacy">Pharmacy & Healthcare</option>
                    <option value="electronics">Electronics & Hardware</option>
                    <option value="other">Other Multi-Outlet Retail</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Store Branches</label>
                  <select
                    value={formData.stores}
                    onChange={(e) => setFormData({ ...formData, stores: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="1">1 Location</option>
                    <option value="2-5">2 - 5 Locations</option>
                    <option value="6-20">6 - 20 Locations</option>
                    <option value="20+">20+ Locations (Enterprise)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">How Can We Help?</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tell us about your current setup, hardware models, or what features you're looking for..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                className="hidden"
              />

              {error && (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition active:scale-[0.99] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                <span>{submitting ? "Sending..." : "Submit Inquiry & Schedule Demo"}</span>
              </button>
            </form>
          )}
        </div>

        {/* Right Info Cards (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-bold text-white">Direct Communication Channels</h2>
            
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-slate-400">Technical Support & Helpdesk:</div>
                  <a href={`mailto:${site.contactEmail}`} className="font-semibold text-white hover:text-emerald-400 transition">
                    {site.contactEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-slate-400">Phone Hotline (US / Global):</div>
                  <div className="font-semibold text-white">{site.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-slate-400">Support Response SLA:</div>
                  <div className="font-semibold text-white">&lt; 15 mins (Pro & Enterprise) / 2 hrs (Standard)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span>Free Catalog Migration Assistance</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Already have hundreds of products in another POS or spreadsheet? Send us your CSV/Excel file, and our engineers will format and import it for free.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
