import React from "react";
import { FaqItem, PricingPlan, SiteConfig } from "@/lib/constants";

interface JsonLdProps {
  site: SiteConfig;
  plans: PricingPlan[];
  faqs: FaqItem[];
}

export function JsonLd({ site, plans, faqs }: JsonLdProps) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": site.name,
    "url": site.url,
    "logo": `${site.url}/logo.png`,
    "description": site.description,
    "email": site.contactEmail,
    "sameAs": [
      "https://twitter.com/PosBuzzApp",
      "https://linkedin.com/company/posbuzz"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": site.phone,
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
    "offers": plans.map((plan) => ({
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
    "mainEntity": faqs.map((faq) => ({
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
    "name": site.name,
    "url": site.url,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${site.url}/search?q={search_term_string}`
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
