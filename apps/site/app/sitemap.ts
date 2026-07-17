import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { DOCS_FLAT } from "@/lib/docs-nav";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/skills`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/roadmap`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE.url}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];
  const docs: MetadataRoute.Sitemap = DOCS_FLAT.map((d) => ({
    url: `${SITE.url}${d.href}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...base, ...docs];
}
