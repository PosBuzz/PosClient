import {
  CORE_FEATURES,
  DEMO_PRODUCTS,
  FAQ_ITEMS,
  FaqItem,
  FeatureItem,
  PRICING_PLANS,
  PricingPlan,
  SITE_CONFIG,
  SOLUTIONS,
  SolutionItem,
  TESTIMONIALS,
  Testimonial,
  DemoProduct,
  SiteConfig,
} from "./constants";

/**
 * Content for the marketing site comes from the PosBuzz backend CMS
 * (`/api/v1/public/portfolio/content`), managed by super admins. The constants
 * in `constants.ts` are the build-time fallback: if the API is unreachable or a
 * collection is empty, the site still renders its last known-good copy rather
 * than going blank.
 */

const API_BASE_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

// How long a rendered page may serve cached CMS content before revalidating.
const REVALIDATE_SECONDS = Number(process.env.CMS_REVALIDATE_SECONDS || 300);

export interface PortfolioContent {
  site: SiteConfig;
  solutions: SolutionItem[];
  features: FeatureItem[];
  pricingPlans: PricingPlan[];
  faqs: FaqItem[];
  testimonials: Testimonial[];
  demoProducts: DemoProduct[];
}

interface ApiSettings {
  site_name: string;
  title: string;
  description: string;
  url: string;
  og_image: string;
  author: string;
  contact_email: string;
  sales_email: string;
  phone: string;
  address?: string | null;
  keywords: string[];
}

interface ApiContent {
  settings: ApiSettings | null;
  solutions: Record<string, never>[];
  features: Record<string, never>[];
  pricing_plans: Record<string, never>[];
  faqs: Record<string, never>[];
  testimonials: Record<string, never>[];
  demo_products: Record<string, never>[];
}

const FALLBACK: PortfolioContent = {
  site: SITE_CONFIG,
  solutions: SOLUTIONS,
  features: CORE_FEATURES,
  pricingPlans: PRICING_PLANS,
  faqs: FAQ_ITEMS,
  testimonials: TESTIMONIALS,
  demoProducts: DEMO_PRODUCTS,
};

const num = (value: unknown) => Number(value ?? 0);

/* eslint-disable @typescript-eslint/no-explicit-any */

const mapSettings = (settings: ApiSettings | null): SiteConfig =>
  settings
    ? {
        name: settings.site_name,
        title: settings.title,
        description: settings.description,
        url: settings.url,
        ogImage: settings.og_image,
        author: settings.author,
        contactEmail: settings.contact_email,
        salesEmail: settings.sales_email,
        phone: settings.phone,
        address: settings.address || undefined,
        keywords: settings.keywords || [],
      }
    : SITE_CONFIG;

const mapSolution = (row: any): SolutionItem => ({
  id: row.slug,
  title: row.title,
  subtitle: row.subtitle,
  iconName: row.icon_name,
  badge: row.badge,
  description: row.description,
  features: row.features || [],
  benefits: row.benefits || [],
  metrics: { label: row.metric_label, value: row.metric_value },
  imagePlaceholder: row.image_key,
});

const mapFeature = (row: any): FeatureItem => ({
  id: row.slug,
  category: row.category,
  title: row.title,
  tagline: row.tagline,
  description: row.description,
  highlights: row.highlights || [],
  icon: row.icon,
  badge: row.badge || undefined,
});

const mapPlan = (row: any): PricingPlan => ({
  id: row.slug,
  name: row.name,
  badge: row.badge || undefined,
  description: row.description,
  priceMonthly: num(row.price_monthly),
  priceAnnualMonthly: num(row.price_annual_monthly),
  popular: !!row.is_popular,
  features: row.features || [],
  notIncluded: row.not_included || [],
  cta: row.cta,
});

const mapFaq = (row: any): FaqItem => ({
  question: row.question,
  answer: row.answer,
  aeoSummary: row.aeo_summary,
  category: row.category,
});

const mapTestimonial = (row: any): Testimonial => ({
  quote: row.quote,
  author: row.author,
  role: row.role,
  company: row.company,
  rating: num(row.rating),
  metrics: row.metrics || "",
});

const mapDemoProduct = (row: any): DemoProduct => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  price: num(row.price),
  wholesalePrice: num(row.wholesale_price),
  category: row.category,
  image: row.image,
  tax: num(row.tax),
  serial: row.serial || null,
});

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Empty collections fall back so an accidentally emptied table never blanks a page. */
const orFallback = <T,>(mapped: T[], fallback: T[]) =>
  mapped.length ? mapped : fallback;

export async function getPortfolioContent(): Promise<PortfolioContent> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/portfolio/content`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["portfolio-content"] },
    });

    if (!response.ok) {
      throw new Error(`CMS responded with ${response.status}`);
    }

    const data = (await response.json()) as ApiContent;

    return {
      site: mapSettings(data.settings),
      solutions: orFallback(
        (data.solutions || []).map(mapSolution),
        FALLBACK.solutions,
      ),
      features: orFallback(
        (data.features || []).map(mapFeature),
        FALLBACK.features,
      ),
      pricingPlans: orFallback(
        (data.pricing_plans || []).map(mapPlan),
        FALLBACK.pricingPlans,
      ),
      faqs: orFallback((data.faqs || []).map(mapFaq), FALLBACK.faqs),
      testimonials: orFallback(
        (data.testimonials || []).map(mapTestimonial),
        FALLBACK.testimonials,
      ),
      demoProducts: orFallback(
        (data.demo_products || []).map(mapDemoProduct),
        FALLBACK.demoProducts,
      ),
    };
  } catch (error) {
    console.error("[portfolio] CMS fetch failed, serving bundled content:", error);
    return FALLBACK;
  }
}

export interface LeadPayload {
  type: "CONTACT" | "DEMO";
  name: string;
  email: string;
  phone?: string;
  business_name?: string;
  industry?: string;
  locations?: string;
  message?: string;
  source_page?: string;
  company_website?: string;
}

/** Server-side only: called by the /api/leads route handler. */
export async function submitLead(payload: LeadPayload) {
  const response = await fetch(`${API_BASE_URL}/public/portfolio/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Lead submission failed with ${response.status}`);
  }

  return response.json();
}
