import {
  ArrowRight, BellRing, Bot, Bus, CalendarCheck, Check, ClipboardList, Cloud, FileLock2, GraduationCap, KeyRound,
  Landmark, LayoutGrid, Library, MessageSquare, Rocket, ScrollText, ShieldCheck, Smartphone, Upload, UserCog, Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { OrbitGraphic } from "@/components/illustrations";
import { Faq, GlowBackdrop, PRICING_FAQ, Section, SectionHeading } from "@/components/marketing/section";
import { buttonVariants } from "@/components/ui/button";
import { getPlans } from "@/lib/api/public";
import { inr } from "@/lib/format";
import { JsonLd, SOFTWARE, faqPage, graph, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "School Management Software & School ERP in India | Vidyanexa",
  absoluteTitle: true,
  description:
    "Vidyanexa is school management software for Indian schools: admissions, attendance, fees, exams, bus tracking, HR and a parent app. Start a 14-day free trial.",
  path: "/",
  keywords: [
    "school management software", "school ERP", "school management system India", "school ERP software", "school administration software",
    "CBSE school software", "school app for parents", "school fee management software", "student attendance software", "school bus tracking app",
  ],
});

const HOME_FAQ = [
  { q: "What is school management software?", a: "School management software (also called a school ERP) brings a school's daily work into one system: admissions, student records, attendance, fees, exams and report cards, timetables, transport, staff and payroll, and communication with parents. Vidyanexa does all of this on the web and in mobile apps for parents, staff and drivers." },
  { q: "Is Vidyanexa suitable for CBSE, ICSE and state board schools?", a: "Yes. Vidyanexa is built for Indian schools. It supports CBSE grading (A1 to E), co-scholastic grades, Indian fee practices such as quarterly terms and sibling concessions, and prices in rupees." },
  { q: "Do parents get a mobile app?", a: "Yes. Parents and students use the Vidyanexa app on Android and iOS for attendance, homework, fees and receipts, results, notices, messages with teachers and live school bus tracking." },
  { q: "How much does Vidyanexa cost?", a: "Plans start at ₹2,999 a month for the Basic plan, with Pro at ₹7,999 and Max at ₹17,999. You can also build a custom plan with only the modules you need. Prices exclude GST, and every plan starts with a 14-day free trial." },
  { q: "Is our school's data secure?", a: "Each school's data is isolated inside the database with row-level security, all traffic is encrypted, every important action is recorded in an audit log, and data is backed up daily. Schools can export all their data at any time." },
  { q: "Can we move our existing data into Vidyanexa?", a: "Yes. Students, parents and staff can be imported from Excel or CSV files, and parent accounts are created automatically." },
  ...PRICING_FAQ.slice(0, 2),
];

const FEATURE_GROUPS = [
  {
    title: "Academics",
    color: "text-primary bg-primary/10",
    items: [
      { href: "/features/school-admission-management", icon: GraduationCap, name: "Students & admissions", text: "Profiles, documents, promotions and CSV import." },
      { href: "/features/attendance-management-system", icon: CalendarCheck, name: "Attendance", text: "Class, period, QR and biometric attendance with alerts." },
      { href: "/features/online-exam-report-card-software", icon: ClipboardList, name: "Exams & report cards", text: "Marks entry, grading, online tests and printable report cards." },
    ],
  },
  {
    title: "Finance",
    color: "text-success bg-success/10",
    items: [
      { href: "/features/school-fee-management-software", icon: Wallet, name: "Fee collection", text: "Fee structures, concessions, UPI and online payments, instant receipts." },
      { href: "/features/school-fee-management-software", icon: Landmark, name: "Accounts", text: "Expenses, ledgers and Tally export for your accountant." },
      { href: "/features/school-hr-payroll-software", icon: UserCog, name: "HR & payroll", text: "Staff records, leave approvals and salary slips." },
    ],
  },
  {
    title: "Operations",
    color: "text-warning bg-warning/10",
    items: [
      { href: "/features/school-bus-gps-tracking", icon: Bus, name: "Transport", text: "Routes, live bus location and boarding with the driver app." },
      { href: "/features/school-library-management-system", icon: Library, name: "Library & hostel", text: "Catalogue, issue and return, rooms and allocations." },
      { href: "/features/school-visitor-gate-pass-management", icon: ShieldCheck, name: "Gate & security", text: "Gate passes, visitor logs and campus workers." },
    ],
  },
  {
    title: "Engagement",
    color: "text-info bg-info/10",
    items: [
      { href: "/features/parent-teacher-communication-app", icon: MessageSquare, name: "Communication", text: "Notices, SMS, WhatsApp, email and chat with parents." },
      { href: "/features/parent-teacher-communication-app", icon: BellRing, name: "Notifications", text: "Absences, fee reminders and announcements, automatically." },
      { href: "/features", icon: Bot, name: "AI assistant", text: "Ask questions about your school's data in plain English." },
    ],
  },
];

const SECURITY = [
  { icon: FileLock2, title: "Isolated by design", text: "Each school's records are separated inside the database itself, so one school can never read another's data." },
  { icon: KeyRound, title: "Role-based access", text: "Teachers, accountants, parents and drivers only see what their role needs." },
  { icon: ScrollText, title: "Full audit trail", text: "Every sign-in and change is recorded with who, what and when." },
  { icon: Cloud, title: "Backed up daily", text: "Automatic daily backups, encrypted connections and secure sign-in sessions." },
];

const STEPS = [
  { icon: Rocket, title: "Start your free trial", text: "Pick a plan or build your own. Your school is ready in under a minute." },
  { icon: Upload, title: "Bring your data", text: "Import students and staff from spreadsheets, or let our team do it for you." },
  { icon: Smartphone, title: "Go live", text: "Staff sign in on the web, parents and drivers install the app." },
];

function HeroChip({ className, icon, tint, title, value }: { className: string; icon: React.ReactNode; tint: string; title: string; value: string }) {
  return (
    <div aria-hidden className={cn("absolute z-10 hidden items-center gap-3 rounded-2xl border bg-card/90 px-4 py-3 shadow-xl backdrop-blur md:flex", className)}>
      <span className={cn("flex size-9 items-center justify-center rounded-xl", tint)}>{icon}</span>
      <span className="text-left">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{value}</span>
      </span>
    </div>
  );
}

export default async function HomePage() {
  const plans = await getPlans().catch(() => []);

  return (
    <>
      <JsonLd data={graph(SOFTWARE, faqPage(HOME_FAQ))} />
      {/* Hero */}
      <section className="relative isolate overflow-hidden px-5 pt-16 pb-20 sm:px-8 lg:pt-24">
        <GlowBackdrop />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5 text-xs font-medium shadow-xs backdrop-blur hover:border-primary/40">
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>
              Build a custom plan with only the modules you need <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <p className="mt-6 text-sm font-semibold tracking-wide text-primary uppercase">School management software for Indian schools</p>
            <h1 className="mt-3 font-heading text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-6xl">
              Run your whole school{" "}
              <span className="shimmer-text bg-gradient-to-r from-primary via-[oklch(0.65_0.105_74)] to-primary bg-clip-text text-transparent">from one place</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
              A complete school ERP for admissions, attendance, fees, exams, transport and parent communication, in one secure platform with apps for parents, staff and drivers.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonVariants({ size: "lg", className: "h-12 px-7 text-base shadow-lg shadow-primary/25" })}>
                Start 14-day free trial <ArrowRight aria-hidden />
              </Link>
              <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-7 text-base" })}>
                See pricing
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No credit card needed", "Plans from ₹2,999/month", "Prices in INR"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-success" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto mt-16 max-w-6xl">
            <div className="absolute -inset-x-6 -top-6 -bottom-10 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-2xl" aria-hidden />
            <HeroChip className="float-chip -top-6 -left-4 xl:-left-14" icon={<CalendarCheck className="size-4" />} tint="bg-success/15 text-success" title="Attendance marked" value="Class 5-A · 38/40 present" />
            <HeroChip className="float-chip float-chip-2 top-1/3 -right-4 xl:-right-16" icon={<Wallet className="size-4" />} tint="bg-primary/15 text-primary" title="Fee received" value="₹12,500 · Receipt sent" />
            <HeroChip className="float-chip float-chip-3 -bottom-6 left-1/4" icon={<Bus className="size-4" />} tint="bg-warning/15 text-warning" title="Bus 4 is 5 min away" value="Parents notified" />
            <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl ring-1 ring-black/5">
              <div className="flex h-9 items-center gap-1.5 border-b bg-muted/60 px-4" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
              </div>
              <Image src="/marketing/dashboard-light.png" alt="The Vidyanexa school dashboard showing sign-in activity, people by role and plan usage" width={1440} height={900} priority sizes="(min-width: 1200px) 1152px, calc(100vw - 40px)" className="block w-full dark:hidden" />
              <Image src="/marketing/dashboard-dark.png" alt="The Vidyanexa school dashboard in dark mode" width={1440} height={900} loading="lazy" sizes="(min-width: 1200px) 1152px, calc(100vw - 40px)" className="hidden w-full dark:block" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <Section id="features" className="bg-muted/30">
        <SectionHeading
          eyebrow="Everything in one platform"
          title="Sixteen modules. One login. No spreadsheets."
          description="Switch on what your school needs today and add more as you grow. Every module works on the web and in the apps."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.title} className="rounded-2xl border bg-card p-7 shadow-xs">
              <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</p>
              <ul className="mt-5 space-y-5">
                {g.items.map(({ href, icon: Icon, name, text }) => (
                  <li key={name} className="flex gap-4">
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", g.color)}><Icon className="size-5" aria-hidden /></span>
                    <span>
                      <Link href={href} className="block font-semibold hover:text-primary hover:underline">{name}</Link>
                      <span className="block text-sm text-muted-foreground">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center">
          <Link href="/features" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            Explore every feature in detail <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </Section>

      {/* Apps */}
      <Section>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Apps for everyone"
              title="Parents, staff and drivers each get an app built for them"
              description="Parents see attendance, fees and homework. Teachers mark attendance in seconds. Drivers share the bus location automatically. Everyone signs in with their school ID."
            />
            <ul className="mt-8 space-y-3">
              {[
                ["Vidyanexa", "for parents and students"],
                ["Vidyanexa Staff", "for teachers and office staff"],
                ["Vidyanexa Driver", "for school bus drivers"],
              ].map(([name, who]) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Smartphone className="size-4.5" aria-hidden /></span>
                  <span><span className="font-semibold">{name}</span> <span className="text-muted-foreground">{who}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <OrbitGraphic className="absolute top-1/2 left-1/2 -z-10 w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2"
              icons={[<CalendarCheck key="a" />, <Wallet key="b" />, <Bus key="c" />, <MessageSquare key="d" />, <GraduationCap key="e" />, <BellRing key="f" />]} />
            <div className="overflow-hidden rounded-[2.5rem] border-8 border-foreground/90 bg-card shadow-2xl">
              <Image src="/marketing/app-parent.png" alt="The Vidyanexa parent app home screen" width={412} height={860} sizes="384px" className="block w-full" />
            </div>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-wide text-[oklch(0.82_0.09_82)] uppercase">Security & privacy</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Your students&apos; data deserves serious protection</h2>
          <p className="mt-4 text-lg text-sidebar-foreground/80">Built with India&apos;s Digital Personal Data Protection Act in mind, from the database up.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <Icon className="size-6 text-[oklch(0.82_0.09_82)]" aria-hidden />
              <p className="mt-4 font-semibold text-white">{title}</p>
              <p className="mt-1.5 text-sm text-sidebar-foreground/75">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section>
        <SectionHeading eyebrow="Getting started" title="Live in days, not months" />
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-2xl border bg-card p-7 shadow-xs">
              <span className="absolute top-6 right-6 font-heading text-5xl font-extrabold text-muted/80" aria-hidden>{i + 1}</span>
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" aria-hidden /></span>
              <p className="mt-5 text-lg font-semibold">{title}</p>
              <p className="mt-1.5 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Pricing teaser */}
      {plans.length > 0 && (
        <Section className="bg-muted/30">
          <SectionHeading eyebrow="Pricing" title="Simple plans in rupees" description="Start on any plan free for 14 days. Pay yearly and get two months free." />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {plans.map((p) => (
              <Link
                key={p.code}
                href={`/pricing#plan-${p.code}`}
                className={cn("group rounded-2xl border bg-card p-7 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md", p.highlight && "border-primary/50 ring-1 ring-primary/30")}
              >
                <p className="flex items-center justify-between text-lg font-bold">{p.name}{p.highlight && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">Most popular</span>}</p>
                <p className="mt-3"><span className="font-heading text-3xl font-extrabold tabular">{inr(p.price_monthly)}</span><span className="text-sm text-muted-foreground">/month</span></p>
                <p className="mt-2 text-sm text-muted-foreground">{p.max_students === null ? "Unlimited students" : `Up to ${p.max_students.toLocaleString("en-IN")} students`} · {p.modules.length} modules</p>
                <p className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">Compare plans <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></p>
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center text-muted-foreground">
            Need something different? <Link href="/pricing#custom" className="font-semibold text-primary hover:underline">Build a custom plan</Link>
          </p>
        </Section>
      )}

      {/* FAQ */}
      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions schools ask about school management software" />
        <div className="mt-12"><Faq items={HOME_FAQ} /></div>
      </Section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.21_0.05_264)] via-[oklch(0.27_0.062_264)] to-[oklch(0.35_0.07_258)] px-8 py-16 text-center text-white shadow-xl sm:px-16">
          <LayoutGrid className="absolute -top-10 -right-10 size-64 text-white/5" aria-hidden />
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to bring your school onto Vidyanexa?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Start free for 14 days. Set up takes a minute; no card needed.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-base font-semibold text-[oklch(0.25_0.058_264)] shadow-sm transition hover:bg-white/90 outline-none focus-visible:ring-3 focus-visible:ring-white/60">Start free trial</Link>
            <Link href="/contact" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 border-white/40 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white" })}>Talk to us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
