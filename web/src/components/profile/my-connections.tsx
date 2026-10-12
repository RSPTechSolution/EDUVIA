"use client";

import { BookOpen, GraduationCap, UsersRound } from "lucide-react";
import Link from "next/link";
import { PercentBadge } from "@/components/attendance/status";
import { PersonSections, StudentOverviewCards } from "@/components/profile/sections";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { inr } from "@/lib/format";
import { useMyOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** On your own profile: everything connected to you, from your classes or children to your books, bus and leave. */
export function MyConnections() {
  const q = useMyOverview();
  if (q.isLoading) return <div className="mt-6 grid gap-6 lg:grid-cols-2" aria-busy="true"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;
  const u = q.data;
  if (!u) return null;
  const staff = u.role !== "parent" && u.role !== "student";
  return (
    <section className="mt-8 space-y-6" aria-labelledby="mine">
      <h2 id="mine" className="text-xl font-bold">Everything connected to you</h2>

      {staff && (u.class_teacher_of.length > 0 || u.teaching.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="size-4 text-primary" aria-hidden />My classes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {u.class_teacher_of.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Class teacher (incharge) of</p>
                <div className="flex flex-wrap gap-2">
                  {u.class_teacher_of.map((s) => <Link key={s.section_id} href="/my-class" className="rounded-full border bg-primary/[0.06] px-3 py-1 text-sm hover:border-primary/40">{s.label} <span className="text-muted-foreground">· {s.students} students</span></Link>)}
                </div>
              </div>
            )}
            {u.teaching.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">I teach</p>
                <ul className="flex flex-wrap gap-2">{u.teaching.map((t) => <li key={t} className="rounded-full border px-3 py-1 text-sm">{t}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {u.role === "parent" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-4 text-primary" aria-hidden />My children</CardTitle><CardDescription>Attendance is for this month.</CardDescription></CardHeader>
          <CardContent>
            {u.children.length === 0 ? <p className="text-sm text-muted-foreground">No children are linked to your account yet. Please contact the school office.</p> : (
              <ul className="space-y-3">
                {u.children.map((c) => (
                  <li key={c.student_id} className="flex items-center gap-3 rounded-xl border p-3.5">
                    <span className="min-w-0 flex-1"><span className="block font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.class_section}{c.admission_no ? ` · ${c.admission_no}` : ""}</span></span>
                    {c.attendance_percent !== null && <Link href="/my-attendance"><PercentBadge value={c.attendance_percent} /></Link>}
                    {c.fee_due !== null && (
                      <Link href="/my-fees" className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular", c.fee_due <= 0 ? "bg-success/12 text-success" : c.fee_overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                        {c.fee_due <= 0 ? "Fees paid" : `${inr(c.fee_due)} ${c.fee_overdue ? "overdue" : "due"}`}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {u.role === "student" && u.student && u.student_overview && (
        <>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="size-4" aria-hidden />{u.student.name} · {u.student.class_section}{u.student.admission_no ? ` · ${u.student.admission_no}` : ""}</p>
          <StudentOverviewCards o={u.student_overview} studentId={u.student.student_id} family />
        </>
      )}

      <PersonSections p={u} self />
    </section>
  );
}
