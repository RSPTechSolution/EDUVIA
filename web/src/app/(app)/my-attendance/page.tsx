"use client";

import { format } from "date-fns";
import { useState } from "react";
import { CountsLine, MonthCalendar, PercentBadge, STATUS } from "@/components/attendance/status";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { FamilyIllustration } from "@/components/illustrations";
import { FadeIn } from "@/components/motion/primitives";
import { useSession } from "@/components/session-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useMyAttendance } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** A ring that fills to the attendance percentage. */
function Ring({ value }: { value: number | null }) {
  const pct = value ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = value === null ? "text-muted" : pct < 75 ? "text-destructive" : pct < 85 ? "text-warning" : "text-success";
  return (
    <div className="relative size-36" role="img" aria-label={value === null ? "No attendance yet" : `${pct}% attendance`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} className="fill-none stroke-muted" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} className={cn("fill-none stroke-current transition-[stroke-dashoffset] duration-1000 ease-out", tone)} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-extrabold tabular">{value === null ? "—" : `${pct}%`}</span>
        <span className="text-xs text-muted-foreground">this year</span>
      </div>
    </div>
  );
}

export default function MyAttendancePage() {
  const me = useSession();
  const thisMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(thisMonth);
  const [index, setIndex] = useState(0);
  const q = useMyAttendance(month);
  const list = q.data ?? [];
  const child = list[Math.min(index, list.length - 1)];
  const absences = child?.days.filter((d) => d.status !== "present") ?? [];

  return (
    <>
      <PageHeader title={me.role === "parent" ? "Attendance" : "My attendance"} description="Day-by-day attendance, as marked by the class teacher." />
      {q.isLoading ? <Skeleton className="h-[480px] rounded-2xl" /> : !child ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<FamilyIllustration />} title="Nothing to show yet"
          description="No student is linked to this account. Please contact the school office." />
      ) : (
        <>
          {list.length > 1 && (
            <div role="tablist" aria-label="Child" className="mb-5 flex flex-wrap gap-2">
              {list.map((c, i) => (
                <button key={c.student_id} role="tab" type="button" aria-selected={c.student_id === child.student_id} onClick={() => setIndex(i)}
                  className={cn("rounded-xl border px-4 py-2 text-left transition active:scale-[0.98]", c.student_id === child.student_id ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40")}>
                  <span className="block text-sm font-semibold">{c.name}</span><span className="block text-xs text-muted-foreground">{c.class_section}</span>
                </button>
              ))}
            </div>
          )}
          <FadeIn key={child.student_id} className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <Card className="self-start">
              <CardHeader><CardTitle>{child.name}</CardTitle><CardDescription>{child.class_section}</CardDescription></CardHeader>
              <CardContent className="flex flex-col items-center gap-5">
                <Ring value={child.year_percent} />
                <div className="w-full space-y-2 text-sm">
                  <p className="flex justify-between"><span className="text-muted-foreground">{format(new Date(`${month}-01`), "MMMM")}</span><PercentBadge value={child.month_percent} /></p>
                  {(["present", "absent", "late", "half_day", "leave"] as const).map((s) => (
                    <p key={s} className="flex justify-between"><span className="text-muted-foreground">{STATUS[s].label} (this year)</span><span className="font-semibold tabular">{child.year_counts[s]}</span></p>
                  ))}
                </div>
                {child.year_percent !== null && child.year_percent < 75 && (
                  <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Attendance is below the 75% most boards require to sit exams. Please speak to the class teacher.</p>
                )}
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardContent><MonthCalendar data={child} month={month} onMonthChange={setMonth} maxMonth={thisMonth} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Days away this month</CardTitle><CountsLine counts={child.month_counts} /></CardHeader>
                <CardContent>
                  {absences.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Present every day this month.</p> : (
                    <ul className="divide-y">
                      {absences.map((d) => {
                        const m = STATUS[d.status];
                        return (
                          <li key={d.date} className="flex items-center gap-3 py-2.5 text-sm">
                            <span className={cn("flex size-8 items-center justify-center rounded-lg border", m.chip)}><m.icon className="size-4" aria-hidden /></span>
                            <span className="flex-1">{formatDate(d.date, "EEEE, d MMM")}</span>
                            <span className="text-muted-foreground">{m.label}{d.remark && ` · ${d.remark}`}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </FadeIn>
        </>
      )}
    </>
  );
}
