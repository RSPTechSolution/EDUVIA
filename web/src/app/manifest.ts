import type { MetadataRoute } from "next";

/** Lets people install the web app on a phone or computer. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vidyanexa",
    short_name: "Vidyanexa",
    description: "School management: attendance, fees, exams, messages and more.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F7F2E8",
    theme_color: "#15233F",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
