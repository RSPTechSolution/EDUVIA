/** The public address of the website, for links in the sitemap, robots.txt and social previews. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Google Analytics 4 measurement ID (G-XXXX). Empty = no analytics. Only loaded on the public website. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
