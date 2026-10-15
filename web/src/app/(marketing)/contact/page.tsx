import { Clock, MessageSquare, Rocket } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd, breadcrumbs, graph, pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { GlowBackdrop } from "@/components/marketing/section";
import type { PageQuery } from "@/lib/query-params";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = pageMetadata({
  title: "Contact Vidyanexa: Book a School ERP Demo",
  description: "Talk to the Vidyanexa team: book a demo of the school management software, ask about a custom plan for your school or group, or get help moving your data.",
  path: "/contact",
  keywords: ["school ERP demo", "school management software demo", "contact Vidyanexa"],
});

const POINTS = [
  { icon: MessageSquare, title: "Demos and questions", text: "See Vidyanexa with your own school's workflow in mind." },
  { icon: Rocket, title: "Custom plans and groups", text: "More than 10,000 students, or several schools? We'll put together a plan." },
  { icon: Clock, title: "Fast replies", text: "We answer every message within one business day." },
];

export default async function ContactPage({ searchParams }: { searchParams: Promise<PageQuery> }) {
  const query = await searchParams;
  return (
    <section className="relative isolate overflow-hidden px-5 py-16 sm:px-8 lg:py-24">
      <JsonLd data={graph(breadcrumbs([{ name: "Contact", path: "/contact" }]), { "@type": "ContactPage", name: "Contact Vidyanexa", inLanguage: "en-IN" })} />
      <GlowBackdrop />
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-sm font-medium text-primary">Contact</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Let&apos;s talk about your school</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Tell us what you need and we&apos;ll get back to you. Prefer to try it yourself?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">Start a free trial</Link>.
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
                <span><span className="block font-semibold">{title}</span><span className="block text-muted-foreground">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <ContactForm query={query} />
      </div>
    </section>
  );
}
