"use client";

import { ArrowLeft, Award, FileDown, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { BrandMark } from "@/components/brand/logo";
import { EmptyState } from "@/components/common/empty-state";
import { fmtMarks } from "@/components/exams/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useReportCard } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Printable report card. Staff any time; the student and their parents once results are published. */
export default function ReportCardPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const { id, studentId } = use(params);
  const router = useRouter();
  const q = useReportCard(id, studentId);
  if (q.isLoading) return <Skeleton className="mx-auto h-[760px] max-w-3xl rounded-2xl" />;
  const c = q.data;
  if (!c) return <EmptyState title="Report card not available" description={q.error instanceof ApiError ? q.error.message : undefined} />;
  const r = c.result;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Back</button>
        <div className="flex gap-2">
          <Button variant="outline" render={<a href={`/api/proxy/exams/${id}/report/${studentId}/pdf?download=true`} />}><FileDown aria-hidden />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </div>
      </div>
      {!c.published && <p className="mb-3 rounded-lg bg-warning/10 p-3 text-sm text-warning print:hidden">Draft: results aren&apos;t published, so families can&apos;t see this yet.</p>}
      <article aria-label={`Report card for ${c.student_name}`} className="relative overflow-hidden rounded-2xl border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-brand-gold/10" aria-hidden />
        <header className="flex items-center gap-4 border-b-2 border-slate-900 pb-4">
          <BrandMark size={52} tone="light" />
          <div className="flex-1">
            <p className="text-xl font-extrabold">{c.school_name}</p>
            {c.school_address && <p className="text-xs text-slate-500">{c.school_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Report card</p>
            <p className="text-lg font-bold">{c.exam_name}</p>
            <p className="text-xs text-slate-500">Session {c.academic_year}</p>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 py-5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">Student</dt><dd className="font-bold">{c.student_name}</dd></div>
          <div><dt className="text-xs text-slate-500">Class</dt><dd>{c.class_section}</dd></div>
          <div><dt className="text-xs text-slate-500">Roll no.</dt><dd>{c.roll_no ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Admission no.</dt><dd className="font-mono">{c.admission_no}</dd></div>
          <div><dt className="text-xs text-slate-500">Date of birth</dt><dd>{formatDate(c.date_of_birth)}</dd></div>
          <div><dt className="text-xs text-slate-500">Class teacher</dt><dd>{c.class_teacher ?? "—"}</dd></div>
        </dl>
        <table className="w-full text-sm">
          <caption className="sr-only">Marks by subject</caption>
          <thead><tr className="border-y border-slate-300 bg-slate-50 text-xs text-slate-600">
            <th scope="col" className="px-2 py-2 text-left font-semibold">Subject</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Max</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Pass</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Obtained</th>
            <th scope="col" className="px-2 py-2 text-center font-semibold">Grade</th>
          </tr></thead>
          <tbody>
            {r.subjects.map((s) => (
              <tr key={s.subject_name} className="border-b border-slate-100">
                <th scope="row" className="px-2 py-2 text-left font-medium">{s.subject_name}</th>
                <td className="px-2 py-2 text-right tabular-nums">{fmtMarks(s.max_marks)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-500">{fmtMarks(s.pass_marks)}</td>
                <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", s.passed === false && "text-red-700")}>{s.absent ? "Absent" : fmtMarks(s.marks)}</td>
                <td className="px-2 py-2 text-center font-bold">{s.grade ?? "—"}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 font-bold">
              <th scope="row" className="px-2 py-2 text-left">Total</th>
              <td className="px-2 py-2 text-right tabular-nums">{fmtMarks(r.max_total)}</td>
              <td />
              <td className="px-2 py-2 text-right tabular-nums">{fmtMarks(r.total)}</td>
              <td className="px-2 py-2 text-center">{r.grade ?? "—"}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[["Percentage", r.percent !== null ? `${r.percent}%` : "—"], ["Overall grade", r.grade ?? "—"], ["Rank in class", r.rank ? `${r.rank} of ${c.class_size}` : "—"], ["Attendance", c.attendance_percent !== null ? `${c.attendance_percent}%` : "—"]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-xl font-extrabold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className={cn("mt-4 flex items-center gap-3 rounded-xl p-4", r.passed ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900")}>
          <Award className="size-6 shrink-0" aria-hidden />
          <p className="text-sm font-semibold">{r.passed ? "Passed in all subjects." : "Needs to improve in the subjects marked in red."}</p>
        </div>
        {!!c.co_scholastic?.length && (
          <section className="mt-5">
            <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Co-scholastic areas</h2>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {c.co_scholastic.map((g) => (
                <div key={g.area} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <dt>{g.area}</dt><dd className="font-bold">{g.grade}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1 text-xs text-slate-500">A: outstanding · B: very good · C: fair</p>
          </section>
        )}
        <section className="mt-5">
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Class teacher&apos;s remarks</h2>
          <p className="mt-1 min-h-10 border-b border-dashed border-slate-300 pb-2 text-sm italic">{r.remark ?? ""}</p>
        </section>
        <p className="mt-6 text-[11px] text-slate-500">Grades (CBSE scale): A1 91–100 · A2 81–90 · B1 71–80 · B2 61–70 · C1 51–60 · C2 41–50 · D 33–40 · E below 33</p>
        <footer className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          {["Class teacher", "Principal", "Parent"].map((s) => <div key={s} className="border-t border-slate-400 pt-1">{s}</div>)}
        </footer>
      </article>
    </div>
  );
}
