import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://magiai123.vercel.app";

// Public, indexable pages only — the console/login/access are gated.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/terms", "/privacy"];
  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.5,
  }));
}
