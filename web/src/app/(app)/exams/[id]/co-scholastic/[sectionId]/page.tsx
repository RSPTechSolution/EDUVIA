"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { useCoSheet } from "@/lib/queries";
import { cn } from "@/lib/utils";

const GRADES = ["A", "B", "C"] as const;

function Sheet({ examId, sectionId }: { examId: string; sectionId: string }) {
  const qc = useQueryClient();
  const q = useCoSheet(examId, sectionId);
  const [grades, setGrades] = useState<Record<string, Record<string, string | null>>>({});
  useEffect(() => { if (q.data) setGrades(Object.fromEntries(q.data.rows.map((r) => [r.student_id, { ...r.grades }]))); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api(`/co-scholastic/${examId}/${sectionId}`, { method: "PUT", body: { grades } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["co-scholastic"] }); toast.success("Grades saved"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  if (q.isLoading || !q.data) return <Skeleton className="h-96 rounded-xl" />;
  const sheet = q.data;
  const set = (sid: string, aid: string, g: string) => setGrades((x) => ({ ...x, [sid]: { ...x[sid], [aid]: x[sid]?.[aid] === g ? null : g } }));
  const fillAll = (aid: string, g: string) => setGrades((x) => Object.fromEntries(Object.entries(x).map(([sid, row]) => [sid, { ...row, [aid]: g }])));
  return (
    <>
      <Link href={`/exams/${examId}?tab=results&section=${sectionId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Results</Link>
      <PageHeader title="Co-scholastic grades" description={`${sheet.label}. A: outstanding · B: very good · C: fair. These appear on the report card.`}
        actions={sheet.editable && <Button onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving…"><Save aria-hidden />Save grades</Button>} />
      {!sheet.editable && <Alert className="mb-4"><AlertDescription>Only the class teacher or the exam office can change these, and not after results are published.</AlertDescription></Alert>}
      {sheet.rows.length === 0 ? <EmptyState title="No students in this class" /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Co-scholastic grades for {sheet.label}</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="sticky left-0 bg-card px-4 py-2 text-left font-medium">Student</th>
                {sheet.areas.map((a) => (
                  <th key={a.id} scope="col" className="px-3 py-2 text-center font-medium">
                    {a.name}
                    {sheet.editable && (
                      <span className="mt-1 flex justify-center gap-1">
                        {GRADES.map((g) => <button key={g} type="button" onClick={() => fillAll(a.id, g)} className="rounded border px-1.5 text-[10px] hover:bg-muted" aria-label={`Give everyone ${g} in ${a.name}`}>All {g}</button>)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r) => (
                <tr key={r.student_id} className="border-b last:border-0">
                  <th scope="row" className="sticky left-0 bg-card px-4 py-2 text-left font-medium"><span className="mr-2 text-xs text-muted-foreground tabular">{r.roll_no ?? "–"}</span>{r.name}</th>
                  {sheet.areas.map((a) => (
                    <td key={a.id} className="px-3 py-1.5 text-center">
                      <div className="inline-flex rounded-lg border p-0.5" role="radiogroup" aria-label={`${r.name}: ${a.name}`}>
                        {GRADES.map((g) => {
                          const on = grades[r.student_id]?.[a.id] === g;
                          return (
                            <button key={g} type="button" role="radio" aria-checked={on} disabled={!sheet.editable} onClick={() => set(r.student_id, a.id, g)}
                              className={cn("size-7 rounded-md text-xs font-semibold transition", on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{g}</button>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const { id, sectionId } = use(params);
  return <PermissionGate permission="exams.view"><Sheet examId={id} sectionId={sectionId} /></PermissionGate>;
}
