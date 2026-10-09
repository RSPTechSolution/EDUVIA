import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GoogleAnalytics } from "@/components/marketing/analytics";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";

export const metadata: Metadata = {
  // Public pages are meant to be found (the app itself stays noindex).
  robots: { index: true, follow: true },
  openGraph: { siteName: "Vidyanexa", type: "website", locale: "en_IN", images: [{ url: "/marketing/dashboard-light.png", width: 1600, height: 1000, alt: "The Vidyanexa dashboard" }] },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Vidyanexa", applicationCategory: "EducationalApplication",
        operatingSystem: "Web, Android, iOS", description: "School management for Indian schools: admissions, attendance, fees, exams, transport, HR and parent communication.",
        offers: { "@type": "Offer", priceCurrency: "INR", price: "2999" },
      }) }} />
    </div>
  );
}
