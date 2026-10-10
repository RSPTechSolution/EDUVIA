"use client";

import { format, subDays } from "date-fns";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, Percent, UserX, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CountsLine, PercentBadge } from "@/components/attendance/status";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatCard } from "@/components/common/stat-card";
import { AttendanceTrendChart } from "@/components/dashboard/charts";
import { ClassesIllustration } from "@/components/illustrations";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SectionCard } from "@/lib/api/types";
import { useAttendanceOverview, useAttendanceSections, useSectionReport } from "@/lib/queries";
import { cn } from "@/lib/utils";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function useParam(name: string): [string | null, (v: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  return [params.get(name), (v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(name, v); else next.delete(name);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }];
}

function SectionTile({ s, date, canMark }: { s: SectionCard; date: string; canMark: boolean }) {
  const done = s.students > 0 && s.marked >= s.students;
  const started = s.marked > 0 && !done;
  return (
    <Link href={`/attendance/${s.section_id}?date=${date}`}
      className={cn("card-lift group flex flex-col rounded-xl border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !done && canMark && "border-primary/30")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold">{s.label}</p>
          <p className="truncate text-xs text-muted-foreground">{s.is_class_teacher ? "Your class" : s.class_teacher ? `Class teacher: ${s.class_teacher}` : "No class teacher"}</p>
        </div>
        {done ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-label="Done" />
          : <ClipboardCheck className="size-6 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${s.students ? (s.marked / s.students) * 100 : 0}%` }} />
      </div>
      <p className="mt-2 text-sm">
        {done ? <><span className="font-semibold text-success">{s.present} present</span><span className="text-muted-foreground"> · {s.absent} absent</span></>
          : started ? <span className="text-warning">{s.marked} of {s.students} marked</span>
          : <span className="text-muted-foreground">{s.students} students · {canMark ? "tap to mark" : "not marked yet"}</span>}
      </p>
      {s.marked_by && <p className="mt-0.5 truncate text-xs text-muted-foreground">by {s.marked_by}</p>}
    </Link>
  );
}

function TakeTab({ canMark }: { canMark: boolean }) {
  const [dateParam, setDate] = useParam("date");
  const today = iso(new Date());
  const date = dateParam ?? today;
  const sections = useAttendanceSections(date);
  const pending = sections.data?.filter((s) => s.marked < s.students).length ?? 0;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || null)} aria-label="Date" className="h-9 w-44" />
        <div className="flex gap-1">
          {[0, 1, 2].map((n) => {
            const d = iso(subDays(new Date(), n));
            return <Button key={n} size="sm" variant={d === date ? "default" : "outline"} onClick={() => setDate(n ? d : null)}>{n === 0 ? "Today" : n === 1 ? "Yesterday" : format(subDays(new Date(), n), "EEE d")}</Button>;
          })}
        </div>
        {sections.data && sections.data.length > 0 && (
          <span className={cn("ml-auto rounded-full px-3 py-1 text-xs font-semibold", pending ? "bg-warning/12 text-warning" : "bg-success/12 text-success")}>
            {pending ? `${pending} class${pending > 1 ? "es" : ""} left to mark` : "All classes marked"}
          </span>
        )}
      </div>
      {!sections.data ? <Skeleton className="h-60 rounded-xl" /> : sections.data.length === 0 ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClassesIllustration />} title="No classes to mark"
          description="Only the class teacher (incharge) of a class takes its daily attendance. Ask your school admin to make you the class teacher of a section." />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sections.data.map((s) => <StaggerItem key={s.section_id}><SectionTile s={s} date={date} canMark={canMark} /></StaggerItem>)}
        </Stagger>
      )}
    </>
  );
}

function OverviewTab() {
  const ov = useAttendanceOverview(undefined);
  const o = ov.data;
  return (
    <div className="space-y-6">
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem><StatCard label="Present today" value={o?.percent !== null && o ? `${o.percent}%` : "—"} loading={ov.isLoading} icon={Percent} accent="success" hint={o ? `${o.counts.present + o.counts.late} students` : undefined} /></StaggerItem>
        <StaggerItem><StatCard label="Absent today" value={o?.counts.absent ?? 0} loading={ov.isLoading} icon={UserX} accent="warning" /></StaggerItem>
        <StaggerItem><StatCard label="Classes marked" value={o ? `${o.sections_marked} / ${o.sections_total}` : "—"} loading={ov.isLoading} icon={ClipboardCheck} accent="info" /></StaggerItem>
        <StaggerItem><StatCard label="Students" value={o?.students_total ?? 0} loading={ov.isLoading} icon={Users} /></StaggerItem>
      </Stagger>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Attendance trend</CardTitle><CardDescription>Share of students present, last 14 school days</CardDescription></CardHeader>
          <CardContent>{o ? <AttendanceTrendChart data={o.trend} /> : <Skeleton className="h-56" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" aria-hidden />Below 75%</CardTitle>
            <CardDescription>Last 30 days. Worth a call home.</CardDescription>
          </CardHeader>
          <CardContent>
            {!o ? <Skeleton className="h-48" /> : o.low_attendance.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nobody is below 75%.</p> : (
              <ul className="max-h-72 divide-y overflow-y-auto">
                {o.low_attendance.map((r) => (
                  <li key={r.student_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/students/${r.student_id}`} className="min-w-0 truncate hover:text-primary hover:underline">{r.name}</Link>
                    <PercentBadge value={r.percent} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Today by class</CardTitle>{o && <CountsLine counts={o.counts} />}</CardHeader>
        <CardContent>
          {!o ? <Skeleton className="h-40" /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {o.sections.map((s) => <SectionTile key={s.section_id} s={s} date={o.date} canMark />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportTab() {
  const sections = useAttendanceSections(undefined);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const current = sectionId ?? sections.data?.[0]?.section_id ?? null;
  const report = useSectionReport(current, month);
  const r = report.data;
  const csv = () => {
    if (!r) return;
    const lines = [["Roll", "Name", "Present", "Late", "Half day", "Absent", "Leave", "Percent"],
      ...r.rows.map((x) => [x.roll_no ?? "", x.name, x.counts.present, x.counts.late, x.counts.half_day, x.counts.absent, x.counts.leave, x.percent ?? ""])];
    const blob = new Blob([lines.map((l) => l.map((v) => `"${v}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `attendance-${r.label}-${r.month}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={current ?? ""} onValueChange={(v) => setSectionId(String(v))}>
          <SelectTrigger className="h-9 w-52" aria-label="Class"><SelectValue placeholder="Class">{sections.data?.find((s) => s.section_id === current)?.label}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-72">{sections.data?.map((s) => <SelectItem key={s.section_id} value={s.section_id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="month" value={month} max={format(new Date(), "yyyy-MM")} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" className="h-9 w-44" />
        {r && <p className="text-sm text-muted-foreground">{r.school_days} school days · class average <PercentBadge value={r.average_percent} /></p>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={csv} disabled={!r}><Download aria-hidden />CSV</Button>
      </div>
      {!r ? <Skeleton className="h-96 rounded-xl" /> : (
        <FadeIn key={`${current}${month}`} className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Attendance for {r.label}, {r.month}</caption>
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Roll</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Student</th>
                {["Present", "Late", "Half day", "Absent", "Leave"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 text-right font-semibold">{h}</th>)}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {r.rows.map((x) => (
                <tr key={x.student_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 tabular text-muted-foreground">{x.roll_no ?? "—"}</td>
                  <td className="px-3 py-2 font-medium"><Link href={`/students/${x.student_id}`} className="hover:text-primary hover:underline">{x.name}</Link></td>
                  {(["present", "late", "half_day", "absent", "leave"] as const).map((k) => <td key={k} className="px-3 py-2 text-right tabular">{x.counts[k]}</td>)}
                  <td className="px-3 py-2 text-right"><PercentBadge value={x.percent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </FadeIn>
      )}
    </>
  );
}

function AttendancePage() {
  const can = useCan();
  const admin = can("attendance.manage");
  const canMark = can("attendance.mark");
  const [tabParam, setTab] = useParam("tab");
  const fallback = admin || !canMark ? "overview" : "take";
  const tab = tabParam ?? fallback;
  return (
    <>
      <PageHeader title="Attendance" description={canMark ? "Mark today's attendance and keep an eye on who's missing school." : "Daily attendance across the school."} />
      <Tabs value={tab} onValueChange={(v) => setTab(v === fallback ? null : String(v))} className="mb-5">
        <TabsList>
          {(admin || !canMark) && <TabsTrigger value="overview">Overview</TabsTrigger>}
          <TabsTrigger value="take">{canMark ? "Take attendance" : "By class"}</TabsTrigger>
          <TabsTrigger value="reports">Monthly report</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "overview" && <OverviewTab />}
      {tab === "take" && <TakeTab canMark={canMark} />}
      {tab === "reports" && <ReportTab />}
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="attendance.view">
      <Suspense><AttendancePage /></Suspense>
    </PermissionGate>
  );
}
