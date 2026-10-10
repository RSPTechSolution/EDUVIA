import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
// Google Analytics (public website only) when NEXT_PUBLIC_GA_ID is set.
const ga = process.env.NEXT_PUBLIC_GA_ID ? " https://www.googletagmanager.com https://*.google-analytics.com" : "";

// All API traffic goes through same-origin route handlers, so connect-src can stay 'self'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${ga}`,
  "style-src 'self' 'unsafe-inline'",
  // Map tiles (transport tracking) and files the API serves publicly, such as a school's logo.
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org ${new URL(process.env.API_URL ?? "http://localhost:8000").origin}${ga}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}${ga}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Lets a production build run next to `npm run dev` without sharing `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Docker images run the self-contained server (see web/Dockerfile).
  output: process.env.NEXT_STANDALONE ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  // AVIF is about a fifth smaller than WebP for the screenshots on the public site.
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
