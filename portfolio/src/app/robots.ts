import { MetadataRoute } from "next";
import { getPortfolioContent } from "@/lib/api";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site } = await getPortfolioContent();
  const baseUrl = site.url.replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended", "CCBot"],
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
