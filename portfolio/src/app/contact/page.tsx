import type { Metadata } from "next";
import { ContactClient } from "@/components/ContactClient";
import { getPortfolioContent } from "@/lib/api";

export const metadata: Metadata = {
  title: "Contact Sales & Support | PosBuzz",
  description:
    "Talk to the PosBuzz team about hardware compatibility, catalog migration, or a personalized multi-branch POS demo.",
};

export default async function ContactPage() {
  const { site } = await getPortfolioContent();

  return <ContactClient site={site} />;
}
