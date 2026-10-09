import { ArrowRight, Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Faq, GlowBackdrop, Section, SectionHeading } from "@/components/marketing/section";
import { buttonVariants } from "@/components/ui/button";
import { FEATURES, featureBySlug } from "@/content/features";
import { JsonLd, SOFTWARE, breadcrumbs, faqPage, graph, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = featureBySlug((await params).slug);
  if (!f) return {};
  return pageMetadata({ title: f.metaTitle, description: f.description, path: `/features/${f.slug}`, keywords: f.keywords, image: `/og/${f.slug}.png` });
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const f = featureBySlug((await params).slug);
  if (!f) notFound();
  const related = f.related.map(featureBySlug).filter((x) => !!x);
  return (
    <>
      <JsonLd data={graph(
        breadcrumbs([{ name: "Features", path: "/features" }, { name: f.name, path: `/features/${f.slug}` }]),
        faqPage(f.faqs),
        { "@type": "WebPage", name: f.metaTitle, description: f.description, about: { "@id": SOFTWARE["@id"] }, inLanguage: "en-IN" },
      )} />

      <section className="relative isolate overflow-hidden px-5 pt-10 pb-16 sm:px-8 lg:pt-14">
        <GlowBackdrop />
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li aria-hidden><ChevronRight className="size-3.5" /></li>
              <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
              <li aria-hidden><ChevronRight className="size-3.5" /></li>
              <li aria-current="page" className="font-medium text-foreground">{f.name}</li>
            </ol>
          </nav>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">{f.name}</p>
          <h1 className="mt-3 max-w-4xl font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">{f.h1}</h1>
          <p className="mt-6 max-w-3xl text-lg text-pretty text-muted-foreground">{f.lead}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg", className: "h-11 px-6" })}>Start 14-day free trial</Link>
            <Link href="/pricing" className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-6" })}>See pricing</Link>
          </div>
        </div>
      </section>

      <Section className="bg-muted/30">
        <SectionHeading eyebrow="What you get" title={`${f.name} in Vidyanexa`} />
        <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {f.highlights.map((h) => (
            <li key={h.title} className="rounded-2xl border bg-card p-6 shadow-xs">
              <h3 className="flex items-start gap-2.5 font-heading font-bold">
                <Check className="mt-0.5 size-5 shrink-0 text-brand-gold" aria-hidden />{h.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{h.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className={cn("grid gap-12", f.steps && "lg:grid-cols-2")}>
          <div>
            <SectionHeading align="left" eyebrow="Who it helps" title="Built for everyone involved" />
            <dl className={cn("mt-8 grid gap-6", !f.steps && "md:grid-cols-3")}>
              {f.roles.map((r) => (
                <div key={r.role} className="border-l-2 border-brand-gold/60 pl-4">
                  <dt className="font-semibold">{r.role}</dt>
                  <dd className="mt-1 text-muted-foreground">{r.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          {f.steps && (
            <div>
              <SectionHeading align="left" eyebrow="How it works" title="Up and running in three steps" />
              <ol className="mt-8 grid gap-4">
                {f.steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-4 rounded-xl border bg-card p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                    <span className="pt-1">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Section>

      <Section className="bg-muted/30">
        <SectionHeading eyebrow="FAQ" title={`${f.name}: common questions`} />
        <div className="mt-12"><Faq items={f.faqs} /></div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Related" title="Works together with" />
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {related.map((r) => (
            <li key={r.slug}>
              <Link href={`/features/${r.slug}`} className="group flex h-full flex-col rounded-2xl border bg-card p-6 transition hover:border-primary/40">
                <span className="font-heading font-bold">{r.name}</span>
                <span className="mt-2 flex-1 text-sm text-muted-foreground">{r.description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Read more <ArrowRight className="size-4" aria-hidden /></span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center"><Link href="/features" className="font-semibold text-primary hover:underline">All features</Link></p>
      </Section>
    </>
  );
}
