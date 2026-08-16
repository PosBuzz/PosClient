import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { getPortfolioContent } from "@/lib/api";

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Metadata is rebuilt from the CMS on every ISR revalidation, so SEO copy
// edited in the admin dashboard reaches search engines without a redeploy.
export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getPortfolioContent();

  return {
    metadataBase: new URL(site.url),
    title: {
      default: site.title,
      template: "%s | PosBuzz Cloud POS",
    },
    description: site.description,
    keywords: site.keywords,
    authors: [{ name: site.author, url: site.url }],
    creator: site.author,
    publisher: site.author,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: site.url,
      title: site.title,
      description: site.description,
      siteName: site.name,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "PosBuzz - Cloud POS & Multi-Branch Retail Platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: site.title,
      description: site.description,
      images: ["/og-image.png"],
      creator: "@PosBuzzApp",
    },
    alternates: {
      canonical: site.url,
    },
    manifest: "/manifest.json",
    icons: {
      icon: "/favicon.ico",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { site, pricingPlans, faqs } = await getPortfolioContent();

  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <JsonLd site={site} plans={pricingPlans} faqs={faqs} />
      </head>
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
        <div className="relative min-h-screen flex flex-col justify-between">
          {/* Ambient Background Glows */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[130px]" />
            <div className="absolute top-[40%] right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[140px]" />
            <div className="absolute bottom-10 left-1/3 h-[500px] w-[500px] rounded-full bg-teal-500/10 blur-[150px]" />
            <div className="absolute inset-0 grid-pattern opacity-40" />
          </div>

          <Navbar />
          <main className="relative z-10 flex-1 pt-20">
            {children}
          </main>
          <Footer site={site} />
        </div>
      </body>
    </html>
  );
}
