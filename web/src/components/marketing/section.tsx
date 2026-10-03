import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28", className)}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow, title, description, align = "center",
}: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; align?: "center" | "left" }) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-lg text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}

export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <Accordion className="mx-auto max-w-3xl divide-y rounded-2xl border bg-card px-6 shadow-xs">
      {items.map((it) => (
        <AccordionItem key={it.q} value={it.q} className="border-0">
          <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">{it.q}</AccordionTrigger>
          <AccordionContent className="pb-5 text-muted-foreground">{it.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** Soft brand-coloured glow used behind hero content. */
export function GlowBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute -top-40 left-1/2 h-[560px] w-[1100px] -translate-x-1/2">
        <div className="blob inset-0 bg-[radial-gradient(closest-side,oklch(0.75_0.14_245/0.4),transparent)] dark:bg-[radial-gradient(closest-side,oklch(0.55_0.17_255/0.4),transparent)]" />
      </div>
      <div className="blob blob-delay top-40 -right-40 h-[420px] w-[520px] bg-[radial-gradient(closest-side,oklch(0.85_0.15_150/0.4),transparent)] dark:bg-[radial-gradient(closest-side,oklch(0.6_0.14_160/0.25),transparent)]" />
      <div className="blob top-[28rem] -left-48 h-[380px] w-[480px] bg-[radial-gradient(closest-side,oklch(0.8_0.12_300/0.3),transparent)] dark:bg-[radial-gradient(closest-side,oklch(0.5_0.15_300/0.22),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:56px_56px] opacity-60" />
    </div>
  );
}

export const PRICING_FAQ = [
  { q: "Is there a free trial?", a: "Yes. Every plan, including custom plans, starts with a 14-day free trial. No card is needed, and you can switch plans as often as you like during the trial." },
  { q: "Are prices inclusive of GST?", a: "No. All prices are in Indian rupees and exclude 18% GST, which is added to your invoice." },
  { q: "What happens if we grow past our plan's limits?", a: "You'll see a clear message when you reach your student or staff limit, and you can upgrade at any time. Nothing is deleted and existing users keep working." },
  { q: "How is a custom plan priced?", a: "A small platform fee, plus the modules you choose, plus a per-student charge that gets cheaper as you grow. The price on the builder is exactly what you'll be billed." },
  { q: "Can we pay yearly?", a: "Yes. Paying yearly gives you two months free compared with paying monthly." },
  { q: "Is our school's data kept separate from other schools?", a: "Yes. Every school's records are isolated inside the database itself, not just in the app, so one school can never see another's data." },
];
