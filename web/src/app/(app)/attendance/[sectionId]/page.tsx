"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CheckCheck, Lock, Save } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion/motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PercentBadge, STATUS, STATUS_ORDER, StatusPicker } from "@/components/attendance/status";
import { PermissionGate } from "@/components/common/permission-gate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { AttendanceStatus, Roster } from "@/lib/api/types";
import { formatDateTime, initials } from "@/lib/format";
import { useRoster } from "@/lib/queries";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

type Mark = { status: AttendanceStatus | null; remark: string };

function Marking({ sectionId }: { sectionId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const date = params.get("date") ?? today;
  const roster = useRoster(sectionId, date);
  const qc = useQueryClient();
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [filter, setFilter] = useState<"all" | "unmarked" | "absent">("all");

  useEffect(() => {
    if (roster.data) setMarks(Object.fromEntries(roster.data.students.map((s) => [s.student_id, { status: s.status, remark: s.remark ?? "" }])));
  }, [roster.data]);

  const r = roster.data;
  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
    let unmarked = 0;
    for (const m of Object.values(marks)) if (m.status) c[m.status] += 1; else unmarked += 1;
    return { ...c, unmarked };
  }, [marks]);
  const dirty = r ? r.students.some((s) => marks[s.student_id] && (marks[s.student_id].status !== s.status || (marks[s.student_id].remark || null) !== s.remark)) : false;

  const save = useMutation({
    mutationFn: () => api<Roster>(`/attendance/sections/${sectionId}`, {
      method: "PUT",
      body: { date, records: Object.entries(marks).filter(([, m]) => m.status).map(([id, m]) => ({ student_id: id, status: m.status, remark: m.remark.trim() || null })) },
    }),
    onSuccess: ({ data }) => {
      qc.setQueryData(["attendance", "roster", sectionId, date], data);
      qc.invalidateQueries({ queryKey: ["attendance", "sections"] });
      qc.invalidateQueries({ queryKey: ["attendance", "overview"] });
      toast.success(`Attendance saved for ${data.label}`, { description: `${data.counts.present + data.counts.late} present · ${data.counts.absent} absent` });
      if (data.counts.absent === 0 && data.counts.present + data.counts.late > 0) celebrate({ count: 60 }); // everyone's in today
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save attendance"),
  });

  if (roster.isError) {
    return <Alert variant="destructive"><AlertDescription>{roster.error instanceof ApiError ? roster.error.message : "Could not load this class"}</AlertDescription></Alert>;
  }
  if (!r) return <div className="space-y-3"><Skeleton className="h-20 rounded-xl" />{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const set = (id: string, patch: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  const allPresent = () => setMarks((m) => Object.fromEntries(Object.entries(m).map(([id, x]) => [id, x.status ? x : { ...x, status: "present" }])));
  const visible = r.students.filter((s) => filter === "all" || (filter === "unmarked" ? !marks[s.student_id]?.status : marks[s.student_id]?.status === "absent"));

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{r.label}</h1>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(r.date), "EEEE, d MMMM yyyy")} · {r.students.length} students
            {r.marked_by && <> · last saved by {r.marked_by}{r.marked_at && `, ${formatDateTime(r.marked_at)}`}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} max={today} aria-label="Date" className="h-9 w-44"
            onChange={(e) => e.target.value && router.replace(`/attendance/${sectionId}?date=${e.target.value}`)} />
          {r.editable && <Button variant="outline" onClick={allPresent} disabled={!counts.unmarked}><CheckCheck aria-hidden />Mark rest present</Button>}
        </div>
      </div>

      {!r.editable && <Alert className="mb-4"><Lock className="size-4" /><AlertDescription>{r.locked_reason}</AlertDescription></Alert>}

      <div role="tablist" aria-label="Show" className="mb-3 inline-flex rounded-lg border p-0.5 text-sm">
        {([["all", `All ${r.students.length}`], ["unmarked", `Not marked ${counts.unmarked}`], ["absent", `Absent ${counts.absent}`]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cn("rounded-md px-3 py-1.5 font-medium", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      <ul className="space-y-2 pb-4">
        <AnimatePresence initial={false}>
          {visible.map((s) => {
            const m = marks[s.student_id] ?? { status: null, remark: "" };
            return (
              <motion.li key={s.student_id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className={cn("flex flex-col gap-3 rounded-xl border bg-card p-3 transition-colors sm:flex-row sm:items-center",
                  m.status && STATUS[m.status].chip.split(" ").filter((c) => c.startsWith("border-")).join(" "))}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-7 shrink-0 text-right text-sm text-muted-foreground tabular">{s.roll_no ?? "—"}</span>
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    m.status ? STATUS[m.status].chip : "bg-muted text-muted-foreground")}>{initials(s.name)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">{s.admission_no}<span>Last 30 days</span><PercentBadge value={s.recent_percent} /></p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <StatusPicker name={s.name} value={m.status} disabled={!r.editable} onChange={(st) => set(s.student_id, { status: st })} />
                  {(m.status === "absent" || m.status === "leave" || m.status === "late" || m.remark) && (
                    <Input value={m.remark} onChange={(e) => set(s.student_id, { remark: e.target.value })} disabled={!r.editable} maxLength={200}
                      placeholder="Reason (optional)" aria-label={`Reason for ${s.name}`} className="h-8 sm:w-64" />
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {r.editable && (
        <div className="sticky bottom-4 z-30 rounded-2xl border bg-card/95 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {STATUS_ORDER.map((st) => (
                <li key={st} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", STATUS[st].dot)} aria-hidden />{STATUS[st].label}
                  <motion.span key={counts[st]} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="font-semibold tabular">{counts[st]}</motion.span>
                </li>
              ))}
              {counts.unmarked > 0 && <li className="font-semibold text-warning">{counts.unmarked} not marked</li>}
            </ul>
            <Button size="lg" className="ml-auto h-10" onClick={() => save.mutate()} disabled={!dirty || counts.unmarked === r.students.length}
              loading={save.isPending} loadingText="Saving…">
              <Save aria-hidden />{roster.data?.marked_by ? "Save changes" : "Save attendance"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page({ params }: { params: Promise<{ sectionId: string }> }) {
  const { sectionId } = use(params);
  return (
    <PermissionGate permission="attendance.view">
      <Link href="/attendance" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Attendance</Link>
      <Suspense><Marking sectionId={sectionId} /></Suspense>
    </PermissionGate>
  );
}
