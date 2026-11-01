import type { MetadataRoute } from "next";

/**
 * Crawlers may take everything a visitor can see without signing in, but the
 * API, the auth flow and the preview-only pages stay closed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/signin", "/signup", "/account", "/grey-preview-local", "/workflows/own-comfy"],
    },
    sitemap: "https://haggsfield.studio/sitemap.xml",
  };
}
