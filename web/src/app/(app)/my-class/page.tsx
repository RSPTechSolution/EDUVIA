"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarOff, ClipboardCheck, IndianRupee, Megaphone, Search, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PercentBadge, StatusChip } from "@/components/attendance/status";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatCard } from "@/components/common/stat-card";
import { ClassesIllustration } from "@/components/illustrations";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { MyClass, ReminderResult } from "@/lib/api/types";
import { inr } from "@/lib/format";
import { useMyClass, useMyClasses } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** The class teacher's (incharge's) home for their class: today's attendance, leave, gate passes, fee dues and the roster. */
function MyClassPage() {
  const classes = useMyClasses();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && classes.data?.length) setSelected(classes.data[0].section_id);
  }, [classes.data, selected]);
  const current = classes.data?.find((c) => c.section_id === selected);

  if (classes.isLoading) return <><PageHeader title="My class" /><Skeleton className="h-72 rounded-2xl" /></>;
  if (!classes.data?.length) {
    return (
      <>
        <PageHeader title="My class" />
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClassesIllustration />} title="You aren't a class teacher yet"
          description="The class teacher (incharge) of a section takes its attendance, posts class notices, decides leave and reminds parents about fees. Ask your school admin to make you the class teacher of a section." />
      </>
    );
  }
  return (
    <>
      <PageHeader title="My class" description="Everything about your class in one place: attendance, leave, gate passes and fees." />
      {classes.data.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Your classes">
          {classes.data.map((c) => (
            <Button key={c.section_id} role="tab" aria-selected={c.section_id === selected} size="sm" variant={c.section_id === selected ? "default" : "outline"} onClick={() => setSelected(c.section_id)}>{c.label}</Button>
          ))}
        </div>
      )}
      {current && <ClassView c={current} />}
    </>
  );
}

function ClassView({ c }: { c: MyClass }) {
  const qc = useQueryClient();
  const detail = useMyClass(c.section_id);
  const [q, setQ] = useState("");
  const remind = useMutation({
    mutationFn: () => api<ReminderResult>(`/classes/my/${c.section_id}/fee-reminders`, { method: "POST", body: { overdue_only: true } }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["classes", "my"] });
      if (!data.invoices) toast.info(data.skipped_recent ? "These parents were already reminded in the last 3 days" : "No overdue fees to remind about");
      else toast.success(`Reminded ${data.families} ${data.families === 1 ? "family" : "families"} about ${data.invoices} overdue ${data.invoices === 1 ? "invoice" : "invoices"}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't send reminders"),
  });
  const students = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (detail.data?.students ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || s.admission_no.toLowerCase().includes(term));
  }, [detail.data, q]);

  return (
    <div className="space-y-6">
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard label="Attendance today" icon={ClipboardCheck} accent={c.attendance_marked ? "success" : "warning"}
            value={c.attendance_marked ? `${c.present}/${c.students}` : "Not taken"}
            hint={c.attendance_marked ? `${c.absent} absent · ${c.on_leave} on leave` : `${c.students} students`} />
        </StaggerItem>
        <StaggerItem><StatCard label="Leave requests" icon={CalendarOff} accent={c.pending_leave ? "warning" : "success"} value={c.pending_leave} hint="waiting for you" /></StaggerItem>
        <StaggerItem><StatCard label="Gate passes" icon={Ticket} accent={c.pending_gate_passes ? "warning" : "success"} value={c.pending_gate_passes} hint="waiting for you" /></StaggerItem>
        {c.fees_enabled && (
          <StaggerItem>
            <StatCard label="Overdue fees" icon={IndianRupee} accent={c.students_overdue ? "warning" : "success"} value={inr(c.overdue_amount)}
              hint={`${c.students_overdue} ${c.students_overdue === 1 ? "student" : "students"}`} />
          </StaggerItem>
        )}
      </Stagger>

      <div className="flex flex-wrap gap-2">
        <Link href={`/attendance/${c.section_id}`} className={buttonVariants()}><ClipboardCheck aria-hidden />{c.attendance_marked ? "Update attendance" : "Take attendance"}</Link>
        <Link href="/notices" className={buttonVariants({ variant: "outline" })}><Megaphone aria-hidden />Post a class notice</Link>
        <Link href="/leave" className={buttonVariants({ variant: "outline" })}><CalendarOff aria-hidden />Leave requests{c.pending_leave ? ` (${c.pending_leave})` : ""}</Link>
        <Link href="/gate-pass" className={buttonVariants({ variant: "outline" })}><Ticket aria-hidden />Gate passes{c.pending_gate_passes ? ` (${c.pending_gate_passes})` : ""}</Link>
        {c.fees_enabled && (
          <Button variant="outline" disabled={!c.students_overdue} onClick={() => remind.mutate()} loading={remind.isPending} loadingText="Sending…">
            <BellRing aria-hidden />Remind parents about fees
          </Button>
        )}
      </div>

      <section className="rounded-2xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold"><Users className="size-4" aria-hidden />{c.label}</h2>
            <p className="text-sm text-muted-foreground">Attendance is for this month. Fee due is what&apos;s unpaid now.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" aria-label="Search students" className="h-9 pl-8" />
          </div>
        </div>
        {!detail.data ? <Skeleton className="m-4 h-40 rounded-xl" /> : students.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{q ? "No student matches your search." : "No students in this class yet."}</p>
        ) : (
          <ul className="divide-y" aria-label="Students">
            {students.map((s) => (
              <li key={s.student_id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/students/${s.student_id}`} className="font-medium hover:underline">
                    {s.roll_no !== null && <span className="mr-1.5 text-muted-foreground tabular">{s.roll_no}.</span>}{s.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{s.admission_no}{s.guardians.length ? ` · ${s.guardians.join(" · ")}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {s.today ? <StatusChip status={s.today} /> : <span className="text-xs text-muted-foreground">Not marked</span>}
                  <PercentBadge value={s.attendance_percent} />
                  {detail.data.fees_enabled && (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold tabular",
                      s.fee_due <= 0 ? "bg-success/12 text-success" : s.fee_overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                      {s.fee_due <= 0 ? "Fees paid" : `${inr(s.fee_due)} ${s.fee_overdue ? "overdue" : "due"}`}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="attendance.mark">
      <MyClassPage />
    </PermissionGate>
  );
}
