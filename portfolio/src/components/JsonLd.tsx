import React from "react";
import { FAQ_ITEMS, SITE_CONFIG, PRICING_PLANS } from "@/lib/constants";

export function JsonLd() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_CONFIG.name,
    "url": SITE_CONFIG.url,
    "logo": `${SITE_CONFIG.url}/logo.png`,
    "description": SITE_CONFIG.description,
    "email": SITE_CONFIG.contactEmail,
    "sameAs": [
      "https://github.com/PosBuzz",
      "https://twitter.com/PosBuzzApp",
      "https://linkedin.com/company/posbuzz"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": SITE_CONFIG.phone,
      "contactType": "customer service",
      "availableLanguage": ["English", "Bengali"]
    }
  };

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "PosBuzz POS & Retail Cloud",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web, Windows, macOS, Linux, Android, iOS",
    "offers": PRICING_PLANS.map((plan) => ({
      "@type": "Offer",
      "name": plan.name,
      "price": plan.priceMonthly.toString(),
      "priceCurrency": "USD",
      "description": plan.description,
      "availability": "https://schema.org/InStock"
    })),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "320",
      "bestRating": "5",
      "worstRating": "1"
    },
    "featureList": [
      "High-speed point of sale billing with sub-second barcode scanning",
      "Multi-branch inventory synchronization and stock transfers",
      "Batch expiry (FEFO) and serialized warranty management",
      "MFS payments: bKash, Nagad, Rocket, Upay and bank cards",
      "Customer loyalty and points reward system",
      "Direct ESC/POS local thermal printer agent and barcode label printing",
      "Blind End-of-Day cash reconciliation and operational costs ledger"
    ]
  };

  const faqPageSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ_ITEMS.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_CONFIG.name,
    "url": SITE_CONFIG.url,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_CONFIG.url}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
