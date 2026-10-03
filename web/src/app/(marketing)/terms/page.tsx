import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when a school uses EDUVIA.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="3 October 2026"
      intro={<p>These terms apply when a school (&ldquo;you&rdquo;) uses EDUVIA. By creating an account you agree to them on behalf of your school.</p>}
      sections={[
        {
          id: "service",
          title: "The service",
          body: <p>EDUVIA provides school management software on the web and in mobile apps. The modules and limits available to you depend on your plan.</p>,
        },
        {
          id: "accounts",
          title: "Accounts and security",
          body: (
            <ul>
              <li>You are responsible for who you give accounts to and for keeping passwords private.</li>
              <li>Tell us promptly if you suspect an account has been misused.</li>
              <li>You must have the right to enter the personal data you store, including parental consent for students&apos; data where the law requires it.</li>
            </ul>
          ),
        },
        {
          id: "plans",
          title: "Plans, trials and payment",
          body: (
            <ul>
              <li>New schools get a 14-day free trial. No payment is taken during the trial.</li>
              <li>Prices are in Indian rupees and exclude GST, which is added to invoices.</li>
              <li>Plans are billed monthly or yearly in advance. Yearly plans are charged at ten months&apos; price.</li>
              <li>If you exceed a plan&apos;s student or staff limit, you&apos;ll need to upgrade before adding more users.</li>
              <li>We will give at least 30 days&apos; notice before changing the price of your plan.</li>
            </ul>
          ),
        },
        {
          id: "data",
          title: "Your data",
          body: (
            <p>
              Your school&apos;s data remains yours. We process it only to provide the service, as described in our{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">privacy policy</Link>. You can export
              your data at any time, and when you leave we delete it within 90 days after providing an export on request.
            </p>
          ),
        },
        {
          id: "use",
          title: "Acceptable use",
          body: (
            <ul>
              <li>Don&apos;t use EDUVIA to send spam or unlawful content.</li>
              <li>Don&apos;t try to access another school&apos;s data or interfere with the service.</li>
              <li>Don&apos;t resell the service without our written permission.</li>
            </ul>
          ),
        },
        {
          id: "availability",
          title: "Availability and support",
          body: <p>We work to keep EDUVIA available at all times and back up data daily. Planned maintenance is announced in advance where possible. Support response times depend on your plan.</p>,
        },
        {
          id: "liability",
          title: "Liability",
          body: <p>To the extent the law allows, our total liability for any claim is limited to the fees your school paid in the 12 months before the claim. We are not liable for indirect or consequential losses.</p>,
        },
        {
          id: "ending",
          title: "Cancelling",
          body: <p>You can cancel at any time; your plan stays active until the end of the period you have paid for. We may suspend accounts that break these terms or remain unpaid after reminders.</p>,
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts where EDUVIA is registered.</p>,
        },
      ]}
    />
  );
}
