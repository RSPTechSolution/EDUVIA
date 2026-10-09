"use client";

import { format, subDays } from "date-fns";
import { AlertTriangle, ClipboardCheck, GraduationCap, IndianRupee, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BarList, AttendanceTrendChart, MonthlyCollectionChart } from "@/components/dashboard/charts";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatCard } from "@/components/common/stat-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { inr } from "@/lib/format";
import { useAnalytics } from "@/lib/queries";
import { cn } from "@/lib/utils";

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Analytics() {
  const [from, setFrom] = useState(format(subDays(new Date(), 89), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const q = useAnalytics(from, to);
  const r = q.data;
  return (
    <>
      <PageHeader title="Analytics" description="How the school is doing: enrolment, attendance, fees and results, and the students who need attention."
        actions={
          <div className="flex items-end gap-2">
            <Field label="From">{(a) => <Input {...a} type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" />}</Field>
            <Field label="To">{(a) => <Input {...a} type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-40" />}</Field>
          </div>
        } />
      {!r ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Students" value={r.students} hint={`${r.new_admissions} new this year`} icon={GraduationCap} />
            <StatCard label="Attendance" value={r.attendance_percent != null ? `${r.attendance_percent}%` : "—"} hint={`${r.low_attendance} below 75%`} icon={ClipboardCheck}
              accent={r.attendance_percent != null && r.attendance_percent < 85 ? "warning" : "success"} />
            <StatCard label={`Fees collected ${r.academic_year}`} value={inr(r.fees.collected)} hint={`${r.fees.collection_percent ?? 0}% of ${inr(r.fees.billed)}`} icon={IndianRupee} accent="info" />
            <StatCard label="Need attention" value={r.at_risk_total} hint="Attendance, marks or fees" icon={AlertTriangle} accent={r.at_risk_total ? "danger" : "success"} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Attendance per school day">{r.attendance_trend.length ? <AttendanceTrendChart data={r.attendance_trend} /> : <p className="text-sm text-muted-foreground">No attendance marked in this range.</p>}</Panel>
            <Panel title="Attendance by class">
              <BarList items={r.class_attendance.filter((c) => c.percent != null).map((c) => ({ label: c.name, value: c.percent! }))} format={(v) => `${v}%`} />
            </Panel>
            <Panel title="Fees collected per month"><MonthlyCollectionChart data={r.fees.monthly} /></Panel>
            <Panel title="Unpaid fees by how late">
              <BarList items={r.fees.aging.map((a) => ({ label: a.label, value: a.amount }))} format={(v) => inr(v)} />
              <p className="mt-4 text-sm text-muted-foreground">Outstanding this year: <span className="font-semibold text-foreground">{inr(r.fees.outstanding)}</span></p>
            </Panel>
          </div>

          {r.exam && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title={`${r.exam.name}: average by class`}>
                <p className="mb-3 flex items-center gap-2 text-sm"><Trophy className="size-4 text-warning" aria-hidden />{r.exam.pass_rate}% of students passed every paper</p>
                <BarList items={r.exam.classes.map((c) => ({ label: c.name, value: c.average, hint: c.pass_rate != null ? `${c.pass_rate}% passed` : undefined }))} format={(v) => `${v}%`} />
              </Panel>
              <Panel title={`${r.exam.name}: average by subject (weakest first)`}>
                <BarList items={r.exam.subjects.map((s) => ({ label: s.name, value: s.average }))} format={(v) => `${v}%`} />
              </Panel>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Enrolment by class">
              <BarList items={r.enrolment.map((e) => ({ label: e.name, value: e.students, hint: `${e.girls} girls · ${e.boys} boys` }))} />
            </Panel>
            <Panel title="Largest overdue fees">
              {!r.fees.defaulters.length ? <p className="text-sm text-muted-foreground">No overdue fees.</p> : (
                <ul className="divide-y text-sm">
                  {r.fees.defaulters.map((d) => (
                    <li key={d.student_id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/students/${d.student_id}`} className="min-w-0 hover:underline"><span className="font-medium">{d.name}</span> <span className="text-muted-foreground">· {d.class_section}</span></Link>
                      <span className="text-right tabular"><span className="font-semibold">{inr(d.balance)}</span><span className="block text-xs text-destructive">{d.days_overdue} days late</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title={`Students who need attention (${r.at_risk_total})`}>
            {!r.at_risk.length ? <p className="text-sm text-muted-foreground">No one right now.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Students who need attention</caption>
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="py-2 pr-2">Student</th><th scope="col" className="px-2 py-2">Class</th><th scope="col" className="px-2 py-2">Why</th></tr></thead>
                  <tbody>
                    {r.at_risk.map((s) => (
                      <tr key={s.student_id} className="border-b last:border-0">
                        <td className="py-2 pr-2"><Link href={`/students/${s.student_id}`} className="font-medium hover:underline">{s.name}</Link><span className="block text-xs text-muted-foreground">{s.admission_no}</span></td>
                        <td className="px-2 py-2 whitespace-nowrap">{s.class_section}</td>
                        <td className="px-2 py-2"><div className="flex flex-wrap gap-1.5">{s.reasons.map((x) => <span key={x} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{x}</span>)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="analytics.view"><Analytics /></PermissionGate>;
}
