import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";
import { getPortfolioContent } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getPortfolioContent();

  return {
    title: site.title,
    description: site.description,
    alternates: { canonical: site.url },
  };
}

export default async function HomePage() {
  const { solutions, features, testimonials, faqs, demoProducts } =
    await getPortfolioContent();

  return (
    <HomeClient
      solutions={solutions}
      features={features}
      testimonials={testimonials}
      faqs={faqs}
      demoProducts={demoProducts}
    />
  );
}
