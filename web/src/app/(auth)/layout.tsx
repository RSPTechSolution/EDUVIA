import { Bus, CalendarCheck, GraduationCap, ShieldCheck, Wallet } from "lucide-react";
import { BrandMark, FullLogo, Wordmark } from "@/components/brand/logo";
import { OrbitGraphic } from "@/components/illustrations";

const POINTS = [
  { icon: GraduationCap, text: "Students, classes and timetables in one place" },
  { icon: CalendarCheck, text: "Attendance from the classroom, gate or biometric device" },
  { icon: Wallet, text: "Fees, receipts and accounts without spreadsheets" },
  { icon: ShieldCheck, text: "Every school's data kept strictly separate" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Laid out top-down, with the footer pinned to the bottom: on a slow connection the browser draws the page while
          its HTML is still arriving, and spacing items evenly would move what is already drawn as each piece lands. */}
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-panel p-12 text-panel-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col"
      >
        <div className="grid-fade pointer-events-none absolute inset-0 text-white" />
        <div className="blob -top-40 -right-40 size-[520px] bg-[radial-gradient(circle,rgb(217_226_255/0.22),transparent_65%)]" />
        <div className="blob blob-delay -bottom-48 -left-32 size-[480px] bg-[radial-gradient(circle,rgb(0_25_68/0.35),transparent_65%)]" />
        <div className="blob top-1/3 left-1/2 size-[360px] bg-[radial-gradient(circle,rgb(226_190_116/0.14),transparent_65%)]" />
        <div className="relative flex items-center gap-3">
          <BrandMark size={44} tone="dark" />
          <Wordmark tagline className="text-panel-foreground [&_span:first-child]:text-2xl" />
        </div>
        <div className="relative mt-16 max-w-md">
          <OrbitGraphic
            className="mb-10 w-56 xl:w-64 [&_.border-primary\/15]:border-white/15 [&_.border-primary\/25]:border-white/25"
            icons={[<GraduationCap key="a" className="size-5" />, <CalendarCheck key="b" className="size-5" />, <Wallet key="c" className="size-5" />, <ShieldCheck key="d" className="size-5" />, <Bus key="e" className="size-5" />]}
          />
          <h2 className="text-3xl leading-tight font-bold text-white">
            Run your whole school from one calm, reliable workspace.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-3 text-panel-foreground/90 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-3 [animation-fill-mode:both]" style={{ animationDelay: `${200 + i * 120}ms`, animationDuration: "600ms" }}>
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="absolute bottom-12 left-12 text-xs text-panel-muted">© {new Date().getFullYear()} Vidyanexa</p>
      </section>
      <main className="flex items-center justify-center bg-background px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <FullLogo className="mx-auto mb-10 w-52 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
