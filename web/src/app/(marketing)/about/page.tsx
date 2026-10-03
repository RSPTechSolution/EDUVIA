import { HeartHandshake, Lock, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GlowBackdrop, Section, SectionHeading } from "@/components/marketing/section";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "EDUVIA helps schools spend less time on paperwork and more time on teaching.",
};

const VALUES = [
  { icon: Users, title: "Built for everyone at school", text: "Principals, teachers, office staff, parents and drivers all use EDUVIA — so every screen has to be simple enough for a busy morning." },
  { icon: Lock, title: "Privacy is not optional", text: "Schools hold children's data. We isolate every school's records in the database, keep a full audit trail and collect only what is needed." },
  { icon: HeartHandshake, title: "Fair, transparent pricing", text: "Prices are public, in rupees, and you pay only for the modules you use. No surprise fees." },
  { icon: Sparkles, title: "Useful, not flashy", text: "We add features when they save schools real time — like fee reminders that send themselves and attendance that takes seconds." },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden px-5 py-20 sm:px-8 lg:py-28">
        <GlowBackdrop />
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">About EDUVIA</p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Less paperwork. More teaching.
          </h1>
          <p className="mt-6 text-lg text-pretty text-muted-foreground">
            Schools juggle registers, fee ledgers, WhatsApp groups and spreadsheets that never quite agree. EDUVIA brings
            all of it into one platform, so the office runs smoothly, teachers get time back and parents always know
            what&apos;s happening.
          </p>
        </div>
      </section>

      <Section className="bg-muted/30">
        <SectionHeading eyebrow="What we believe" title="The principles behind every feature" />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border bg-card p-7 shadow-xs">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
              <p className="mt-5 text-lg font-semibold">{title}</p>
              <p className="mt-1.5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">See it for yourself</h2>
          <p className="mt-4 text-lg text-muted-foreground">Start a free 14-day trial, or tell us about your school and we&apos;ll walk you through it.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ size: "lg", className: "h-12 px-7 text-base" })}>Start free trial</Link>
            <Link href="/contact" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-7 text-base" })}>Contact us</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
