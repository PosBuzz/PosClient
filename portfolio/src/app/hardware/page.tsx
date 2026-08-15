import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { 
  Printer, 
  Scan, 
  Scale, 
  Tv, 
  Laptop, 
  Tablet, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  Zap,
  Usb,
  Wifi,
  Bluetooth
} from "lucide-react";

export const metadata: Metadata = {
  title: "POS Hardware Compatibility & Thermal Printer Ecosystem | PosBuzz",
  description: "Seamlessly connect ESC/POS thermal receipt printers (80mm/58mm), 1D/2D barcode scanners, cash drawers, and digital weighing scales with PosBuzz zero-driver bridge.",
};

export default function HardwarePage() {
  const hardwareCategories = [
    {
      title: "Thermal Receipt Printers (80mm / 58mm)",
      icon: Printer,
      description: "Direct web-to-printer bridge. Instant slip cuts, custom logo rendering, and cash drawer kicking over USB, LAN Ethernet, Wi-Fi, or Bluetooth.",
      supportedModels: [
        "Epson TM-T88VI / TM-T20III / TM-m30",
        "Star Micronics TSP143III / TSP654II",
        "Xprinter XP-N160II / XP-Q800 / XP-58",
        "Munbyn ITPP047 / ITPP098",
        "Bixolon SRP-350III / SRP-330II",
        "Standard Generic ESC/POS 58mm/80mm Printers"
      ],
      connectivity: ["USB", "Ethernet / LAN", "Wi-Fi", "Bluetooth", "Serial COM"]
    },
    {
      title: "1D & 2D Barcode / QR Scanners",
      icon: Scan,
      description: "Plug-and-play USB and wireless Bluetooth barcode guns. Sub-second scanning of GS1-128, EAN-13, UPC-A, Code39, and QR payment codes.",
      supportedModels: [
        "Zebra / Symbol DS2208 / DS9308",
        "Honeywell Voyager 1200g / 1400g",
        "Netum Wireless 2D Barcode Guns",
        "Eyoyo Bluetooth Pocket Handhelds",
        "Inateck & TaoTronics Laser Scanners"
      ],
      connectivity: ["USB HID", "Bluetooth 5.0", "2.4GHz Wireless Dongle"]
    },
    {
      title: "Electronic Digital Weighing Scales",
      icon: Scale,
      description: "RS-232 and USB scale integrations. Automatically fetches net weight and calculates price by weight for fruits, vegetables, and deli counters.",
      supportedModels: [
        "Avery Berkel 6700 Series",
        "Mettler Toledo Viva / Impact",
        "CAS PD-II / SW-1 / ER-Plus",
        "Tor-Rey L-EQ / LPC Series"
      ],
      connectivity: ["RS232 Serial COM", "USB Virtual COM"]
    },
    {
      title: "Cash Drawers & Customer Displays (VFD / LCD)",
      icon: Tv,
      description: "Standard RJ11/RJ12 drawer kick triggers on cash settlement. Dual-screen customer display support for order subtotals and marketing promos.",
      supportedModels: [
        "APG Vasario / Series 100 / Series 4000",
        "Star Micronics SMD2-1214 / SMD2-1317",
        "Standard 12V / 24V RJ11 Solenoid Drawers",
        "2x20 VFD Customer Displays & HDMI Dual Monitors"
      ],
      connectivity: ["RJ11 / RJ12 via Printer", "HDMI", "USB VFD"]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
          <Printer className="h-4 w-4" /> Open Hardware Ecosystem
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Use Your Existing POS Hardware. Zero Lock-In.
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          PosBuzz works with standard industry peripherals. Connect your thermal printers, barcode scanners, weighing scales, and cash drawers without expensive vendor lock-in.
        </p>
      </div>

      {/* Hardware Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {hardwareCategories.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <div
              key={idx}
              className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-6 hover:border-emerald-500/40 transition duration-300 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <IconComp className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{item.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {item.connectivity.map((conn, cIdx) => (
                      <span key={cIdx} className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                        {conn}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.description}
              </p>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Popular Tested Models:
                </div>
                <div className="space-y-1.5">
                  {item.supportedModels.map((m, mIdx) => (
                    <div key={mIdx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Device Compatibility Matrix */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-10 text-center space-y-8">
        <div className="space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Supported Operating Devices</h2>
          <p className="text-xs text-slate-400">
            Run PosBuzz on any browser or native PWA installation across desktop and mobile.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-2">
            <Laptop className="h-8 w-8 text-emerald-400 mx-auto" />
            <div className="font-bold text-white text-sm">Windows & Mac PC</div>
            <div className="text-[11px] text-slate-400">Chrome, Edge, Safari, Firefox</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-2">
            <Tablet className="h-8 w-8 text-sky-400 mx-auto" />
            <div className="font-bold text-white text-sm">iPad & iOS Tablets</div>
            <div className="text-[11px] text-slate-400">PWA / Safari Touchscreen</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-2">
            <Tablet className="h-8 w-8 text-amber-400 mx-auto" />
            <div className="font-bold text-white text-sm">Android POS Terminals</div>
            <div className="text-[11px] text-slate-400">Sunmi, iMin, Telpo, Handhelds</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-2">
            <Tv className="h-8 w-8 text-purple-400 mx-auto" />
            <div className="font-bold text-white text-sm">Touchscreen All-in-Ones</div>
            <div className="text-[11px] text-slate-400">Elo Touch, Posiflex, Datalogic</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Have questions about your specific printer or scanner model?</h2>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-xs font-bold text-slate-950 shadow-lg hover:from-emerald-400 hover:to-teal-300 transition"
        >
          <span>Ask Our Hardware Engineers</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
