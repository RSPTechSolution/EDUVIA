import type { Metadata } from "next";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { Faq, GlowBackdrop, PRICING_FAQ, Section, SectionHeading } from "@/components/marketing/section";
import { getPlans, getPricing } from "@/lib/api/public";
import { PricingView } from "./pricing-view";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Vidyanexa plans in INR: Basic, Pro and Max, or build a custom plan with only the modules you need. 14-day free trial on every plan.",
};

export default async function PricingPage() {
  const [plans, catalog] = await Promise.all([getPlans(), getPricing()]);
  return (
    <>
      <section className="relative isolate overflow-hidden px-5 pt-16 pb-24 sm:px-8 lg:pt-24">
        <GlowBackdrop />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">Pricing</p>
            <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">Plans that grow with your school</h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Every plan includes the parent, staff and driver apps, daily backups and a {catalog.trial_days}-day free trial. Prices in INR, excluding GST.
            </p>
          </div>
          <PricingView plans={plans} catalog={catalog} />
        </div>
      </section>

      <Section className="bg-muted/30">
        <SectionHeading eyebrow="Compare" title="What's in each plan" />
        <div className="mt-12">
          <ComparisonTable plans={plans} modules={catalog.modules} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Pricing questions" />
        <div className="mt-12"><Faq items={PRICING_FAQ} /></div>
      </Section>
    </>
  );
}
