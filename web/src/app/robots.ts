import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Crawl the public website; skip the API, school enquiry forms and the signed-in app (which is also noindex). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/apply/", "/offline", "/forgot-password", "/reset-password", "/dashboard", "/account", "/settings", "/platform",
        "/students", "/attendance", "/fees", "/my-", "/exams", "/timetable", "/notices", "/homework", "/hr", "/transport", "/library",
        "/hostel", "/inventory", "/gate", "/compliance", "/cctv", "/analytics", "/assistant", "/messages",
      ],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
