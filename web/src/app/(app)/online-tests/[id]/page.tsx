"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PenLine } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { useAttemptResult, useTestResults } from "@/lib/queries";
import { cn } from "@/lib/utils";

function MarkDialog({ testId, studentId, onClose }: { testId: string; studentId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const r = useAttemptResult(testId, studentId);
  const [marks, setMarks] = useState<Record<string, string>>({});
  useEffect(() => {
    if (r.data) setMarks(Object.fromEntries(r.data.questions.filter((q) => q.kind === "short").map((q) => [q.id, q.awarded != null ? String(q.awarded) : ""])));
  }, [r.data]);
  const save = useMutation({
    mutationFn: () => api(`/online-tests/${testId}/marks/${studentId}`, { method: "PUT", body: { marks: Object.fromEntries(Object.entries(marks).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["online-tests"] }); toast.success("Marks saved"); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not save"),
  });
  const d = r.data;
  return (
    <Dialog open={Boolean(studentId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{d?.student_name ?? "Answers"}</DialogTitle><DialogDescription>{d ? `${d.score ?? 0} of ${d.max_marks} so far` : ""}</DialogDescription></DialogHeader>
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto">
          {d?.questions.map((q, i) => (
            <li key={q.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{i + 1}. {q.text}</p>
              <p className="mt-1">Answer: <span className="font-medium">{Array.isArray(q.your_answer) ? q.your_answer.map((a) => q.options.find((o) => o.id === a)?.text ?? a).join(", ") : q.your_answer || "—"}</span></p>
              {q.kind === "short" ? (
                <label className="mt-2 flex items-center gap-2 text-xs">Marks (of {q.marks})
                  <Input type="number" min={0} max={q.marks} step={0.5} value={marks[q.id] ?? ""} onChange={(e) => setMarks((m) => ({ ...m, [q.id]: e.target.value }))} className="h-8 w-20" />
                </label>
              ) : <p className="text-xs text-muted-foreground">{q.awarded ?? 0} of {q.marks} (marked automatically)</p>}
            </li>
          ))}
        </ol>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => save.mutate()} loading={save.isPending}>Save marks</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Results({ id }: { id: string }) {
  const q = useTestResults(id);
  const [marking, setMarking] = useState<string | null>(null);
  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!q.data) return <EmptyState title="Test not found" />;
  const { test: t, rows, questions } = q.data;
  return (
    <>
      <Link href="/online-tests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Online tests</Link>
      <PageHeader title={t.title} description={`${t.subject_name} · ${t.sections_label} · ${t.max_marks} marks · ${t.submitted} of ${rows.length} submitted${t.average != null ? ` · average ${t.average}%` : ""}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Students and scores</caption>
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="px-4 py-2">Student</th><th scope="col" className="px-2 py-2">Status</th><th scope="col" className="px-2 py-2 text-right">Score</th><th scope="col"><span className="sr-only">Mark</span></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id} className="border-b last:border-0">
                  <td className="px-4 py-2"><span className="font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.section_label}</span></td>
                  <td className="px-2 py-2 text-xs">{r.state === "submitted" ? (r.needs_marking ? <span className="font-semibold text-warning">Needs marking</span> : "Submitted") : r.state === "in_progress" ? "Taking it" : <span className="text-muted-foreground">Not started</span>}</td>
                  <td className="px-2 py-2 text-right tabular">{r.score != null ? `${r.score} (${r.percent}%)` : "—"}</td>
                  <td className="px-2 py-1 text-right">{r.state === "submitted" && <Button variant="ghost" size="sm" onClick={() => setMarking(r.student_id)}><PenLine aria-hidden />{r.needs_marking ? "Mark" : "View"}</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section aria-label="Questions">
          <h2 className="mb-2 font-semibold">How each question went</h2>
          <ol className="space-y-2">
            {questions.map((s, i) => (
              <li key={s.question_id} className="rounded-xl border bg-card p-3 text-sm">
                <p className="line-clamp-2">{i + 1}. {s.text}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden><div className={cn("h-full rounded-full", (s.correct_percent ?? 0) >= 60 ? "bg-success" : "bg-warning")} style={{ width: `${s.correct_percent ?? 0}%` }} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{s.correct_percent != null ? `${s.correct_percent}% got it right` : "Not marked yet"} · {s.answered} answered</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <MarkDialog testId={id} studentId={marking} onClose={() => setMarking(null)} />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PermissionGate permission="tests.manage"><Results id={id} /></PermissionGate>;
}
