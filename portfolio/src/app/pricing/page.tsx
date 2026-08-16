import type { Metadata } from "next";
import { PricingClient } from "@/components/PricingClient";
import { getPortfolioContent } from "@/lib/api";

export const metadata: Metadata = {
  title: "Pricing & Plans | PosBuzz Cloud POS",
  description:
    "Transparent PosBuzz pricing for single stores, growing multi-branch retail chains, and enterprise franchise networks.",
};

export default async function PricingPage() {
  const { pricingPlans } = await getPortfolioContent();

  return <PricingClient plans={pricingPlans} />;
}
