import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/pricing", "/about", "/contact", "/signup", "/privacy", "/terms"], disallow: ["/api/", "/dashboard", "/apply/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
