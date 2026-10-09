import type { MetadataRoute } from "next";
import { FEATURES } from "@/content/features";
import { absolute } from "@/lib/seo";

/** Every public page with its priority. Pages behind sign-in are left out (and marked noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(process.env.NEXT_PUBLIC_BUILD_DATE ?? Date.now());
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") =>
    ({ url: absolute(path), lastModified, changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/features", 0.9, "weekly"),
    ...FEATURES.map((f) => page(`/features/${f.slug}`, 0.8)),
    page("/pricing", 0.9, "weekly"),
    page("/signup", 0.7),
    page("/about", 0.6),
    page("/contact", 0.6),
    page("/login", 0.4, "yearly"),
    page("/privacy", 0.3, "yearly"),
    page("/terms", 0.3, "yearly"),
  ];
}
