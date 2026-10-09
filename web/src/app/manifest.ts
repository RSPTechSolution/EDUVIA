import type { MetadataRoute } from "next";

/** Lets people install the web app on a phone or computer. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EDUVIA",
    short_name: "EDUVIA",
    description: "School management: attendance, fees, exams, messages and more.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
