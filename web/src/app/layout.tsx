import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { inter, jakarta, jetbrains } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
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
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
