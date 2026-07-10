import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://magiai123.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Gated app + APIs shouldn't be crawled.
      disallow: ["/console", "/api/", "/access", "/login"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
