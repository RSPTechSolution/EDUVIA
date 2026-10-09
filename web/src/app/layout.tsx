import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { RegisterServiceWorker } from "@/components/pwa";
import { SITE_URL } from "@/lib/site";
import { inter, jakarta, jetbrains } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "EDUVIA", template: "%s · EDUVIA" },
  description: "EDUVIA — intelligent education management platform for schools.",
  applicationName: "EDUVIA",
  // The app is private: nothing behind sign-in should be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141a2b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(inter.variable, jakarta.variable, jetbrains.variable)}>
      {/* Extensions such as Grammarly add attributes to <body> before React loads. */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
