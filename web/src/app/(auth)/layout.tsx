import { CalendarCheck, GraduationCap, ShieldCheck, Wallet } from "lucide-react";
import { BrandMark, FullLogo, Wordmark } from "@/components/brand/logo";

const POINTS = [
  { icon: GraduationCap, text: "Students, classes and timetables in one place" },
  { icon: CalendarCheck, text: "Attendance from the classroom, gate or biometric device" },
  { icon: Wallet, text: "Fees, receipts and accounts without spreadsheets" },
  { icon: ShieldCheck, text: "Every school's data kept strictly separate" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between"
      >
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.6_0.17_250/0.35),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 size-[480px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.16_150/0.22),transparent_65%)]" />
        <div className="relative flex items-center gap-3">
          <BrandMark size={44} />
          <Wordmark tagline className="text-sidebar-foreground [&_span:first-child]:text-2xl" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-bold text-white">
            Run your whole school from one calm, reliable workspace.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sidebar-foreground/90">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">© {new Date().getFullYear()} EDUVIA</p>
      </section>
      <main className="flex items-center justify-center bg-background px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <FullLogo className="mx-auto mb-10 w-44 lg:hidden dark:rounded-xl dark:bg-white dark:p-2" />
          {children}
        </div>
      </main>
    </div>
  );
}
