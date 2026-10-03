import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";

export const metadata: Metadata = {
  // Public pages are meant to be found (the app itself stays noindex).
  robots: { index: true, follow: true },
  openGraph: { siteName: "EDUVIA", type: "website", locale: "en_IN" },
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean((await cookies()).get(REFRESH_COOKIE)?.value);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
