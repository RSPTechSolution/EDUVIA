"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Save } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GradeBadge, fmtMarks, gradeFor } from "@/components/exams/shared";
import { PermissionGate } from "@/components/common/permission-gate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import type { MarksSheet } from "@/lib/api/types";
import { useMarksSheet } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Entry = { marks: string; absent: boolean };

function Sheet({ examId, paperId, sectionId }: { examId: string; paperId: string; sectionId: string }) {
  const q = useMarksSheet(paperId, sectionId);
  const qc = useQueryClient();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (q.data) setEntries(Object.fromEntries(q.data.rows.map((r) => [r.student_id, { marks: r.marks === null ? "" : String(r.marks), absent: r.absent }])));
  }, [q.data]);
  const s = q.data;
  const invalid = useMemo(() => s ? s.rows.filter((r) => { const e = entries[r.student_id]; const v = Number(e?.marks); return e && !e.absent && e.marks !== "" && (Number.isNaN(v) || v < 0 || v > s.max_marks); }).map((r) => r.student_id) : [], [entries, s]);
  const dirty = s ? s.rows.some((r) => { const e = entries[r.student_id]; return e && (e.absent !== r.absent || (e.marks === "" ? null : Number(e.marks)) !== r.marks); }) : false;
  const filled = s ? s.rows.filter((r) => entries[r.student_id]?.absent || entries[r.student_id]?.marks !== "").length : 0;
  const scores = s ? s.rows.map((r) => entries[r.student_id]).filter((e) => e && !e.absent && e.marks !== "").map((e) => Number(e!.marks)) : [];
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const save = useMutation({
    mutationFn: () => api<MarksSheet>(`/exams/papers/${paperId}/sections/${sectionId}`, {
      method: "PUT",
      body: { entries: s!.rows.map((r) => { const e = entries[r.student_id]; return { student_id: r.student_id, absent: e.absent, marks: e.absent || e.marks === "" ? null : Number(e.marks) }; }) },
    }),
    onSuccess: ({ data }) => {
      qc.setQueryData(["exams", "sheet", paperId, sectionId], data);
      qc.invalidateQueries({ queryKey: ["exams", "sheets"] });
      qc.invalidateQueries({ queryKey: ["exams", "list"] });
      qc.invalidateQueries({ queryKey: ["exams", "detail"] });
      toast.success(`Marks saved for ${data.section_label} · ${data.subject_name}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not save marks"),
  });

  if (q.isError) return <Alert variant="destructive"><AlertDescription>{q.error instanceof ApiError ? q.error.message : "Could not load the sheet"}</AlertDescription></Alert>;
  if (!s) return <Skeleton className="h-96 rounded-xl" />;
  const set = (id: string, patch: Partial<Entry>) => setEntries((x) => ({ ...x, [id]: { ...x[id], ...patch } }));

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{s.section_label} · {s.subject_name}</h1>
        <p className="text-sm text-muted-foreground">{s.exam_name} · out of {fmtMarks(s.max_marks)}, pass mark {fmtMarks(s.pass_marks)} · press Enter to move to the next student</p>
      </div>
      {!s.editable && <Alert className="mb-4"><Lock className="size-4" /><AlertDescription>{s.locked_reason}</AlertDescription></Alert>}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Marks for {s.section_label}, {s.subject_name}</caption>
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-14 px-3 py-2.5 text-left font-semibold">Roll</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Student</th>
              <th scope="col" className="w-36 px-3 py-2.5 text-left font-semibold">Marks</th>
              <th scope="col" className="w-24 px-3 py-2.5 text-left font-semibold">Absent</th>
              <th scope="col" className="w-20 px-3 py-2.5 text-center font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {s.rows.map((r, i) => {
              const e = entries[r.student_id] ?? { marks: "", absent: false };
              const v = e.marks === "" ? null : Number(e.marks);
              const bad = invalid.includes(r.student_id);
              const fail = !e.absent && v !== null && !bad && v < s.pass_marks;
              return (
                <tr key={r.student_id} className={cn("transition-colors", e.absent && "bg-muted/40", bad && "bg-destructive/5")}>
                  <td className="px-3 py-2 text-muted-foreground tabular">{r.roll_no ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-1.5">
                    <Input
                      ref={(el) => { inputs.current[i] = el; }}
                      type="number" inputMode="decimal" step="0.5" min={0} max={s.max_marks}
                      value={e.absent ? "" : e.marks} disabled={!s.editable || e.absent}
                      aria-label={`Marks for ${r.name}`} aria-invalid={bad || undefined}
                      onChange={(ev) => set(r.student_id, { marks: ev.target.value })}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); inputs.current[i + 1]?.focus(); inputs.current[i + 1]?.select(); } }}
                      className={cn("h-9 w-28 text-right font-semibold tabular", fail && "text-destructive")}
                    />
                    {bad && <p className="mt-0.5 text-[11px] text-destructive">0 to {fmtMarks(s.max_marks)}</p>}
                  </td>
                  <td className="px-3 py-2"><Switch checked={e.absent} disabled={!s.editable} onCheckedChange={(c) => set(r.student_id, { absent: c })} aria-label={`${r.name} was absent`} /></td>
                  <td className="px-3 py-2 text-center">{e.absent ? <span className="text-xs font-semibold text-muted-foreground">AB</span> : <GradeBadge grade={v === null || bad ? null : gradeFor((100 * v) / s.max_marks)} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {s.editable && (
        <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-4 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl backdrop-blur">
          <p className="text-sm"><span className="font-semibold tabular">{filled}</span>/{s.rows.length} entered{avg !== null && <> · average <span className="font-semibold tabular">{avg.toFixed(1)}</span></>}</p>
          {invalid.length > 0 && <p className="text-sm font-medium text-destructive">{invalid.length} mark{invalid.length > 1 ? "s" : ""} out of range</p>}
          <Button size="lg" className="ml-auto h-10" disabled={!dirty || invalid.length > 0} onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving…"><Save aria-hidden />Save marks</Button>
        </div>
      )}
      <Link href={`/exams/${examId}`} className="sr-only">Back to the exam</Link>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string; paperId: string; sectionId: string }> }) {
  const { id, paperId, sectionId } = use(params);
  return (
    <PermissionGate permission="exams.view">
      <Link href={`/exams/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Exam</Link>
      <Sheet examId={id} paperId={paperId} sectionId={sectionId} />
    </PermissionGate>
  );
}
