import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GoogleAnalytics } from "@/components/marketing/analytics";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import { DEFAULT_OG, JsonLd, ORGANIZATION, WEBSITE, graph } from "@/lib/seo";

export const metadata: Metadata = {
  // Public pages are meant to be found (the app itself stays noindex). Each page sets its own title, canonical and cards.
  robots: { index: true, follow: true },
  openGraph: { siteName: "Vidyanexa", type: "website", locale: "en_IN", images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: "Vidyanexa school management software" }] },
  twitter: { card: "summary_large_image" },
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean((await cookies()).get(REFRESH_COOKIE)?.value);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
      <GoogleAnalytics />
      <SmoothScroll />
      <JsonLd data={graph(ORGANIZATION, WEBSITE)} />
    </div>
  );
}
