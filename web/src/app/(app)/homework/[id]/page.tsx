"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Check, CheckCheck, RotateCcw, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { colorOf } from "@/components/timetable/grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { HomeworkDetail, HomeworkState } from "@/lib/api/types";
import { useHomework } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATE: Record<HomeworkState, { label: string; cls: string }> = {
  pending: { label: "Not done", cls: "bg-muted text-muted-foreground" },
  done: { label: "Done at home", cls: "bg-info/12 text-info" },
  checked: { label: "Checked", cls: "bg-success/12 text-success" },
  incomplete: { label: "Incomplete", cls: "bg-destructive/10 text-destructive" },
};

type Mark = { status: HomeworkState; remark: string };

function Detail({ id }: { id: string }) {
  const q = useHomework(id);
  const qc = useQueryClient();
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [removing, setRemoving] = useState(false);
  useEffect(() => { if (q.data) setMarks(Object.fromEntries(q.data.roster.map((r) => [r.student_id, { status: r.status, remark: r.remark ?? "" }]))); }, [q.data]);
  const h = q.data;
  const changed = h ? h.roster.filter((r) => marks[r.student_id] && (marks[r.student_id].status !== r.status || (marks[r.student_id].remark || null) !== r.remark)) : [];
  const save = useMutation({
    mutationFn: () => api<HomeworkDetail>(`/homework/${id}/check`, {
      method: "PUT",
      body: { entries: changed.map((r) => ({ student_id: r.student_id, status: marks[r.student_id].status === "done" ? "pending" : marks[r.student_id].status, remark: marks[r.student_id].remark || null })) },
    }),
    onSuccess: ({ data }) => { qc.setQueryData(["homework", "detail", id], data); qc.invalidateQueries({ queryKey: ["homework", "list"] }); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  const del = useMutation({
    mutationFn: () => api(`/homework/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homework"] }); toast.success("Homework removed"); router.push("/homework"); },
    onError: (e) => { setRemoving(false); toast.error(e instanceof ApiError ? e.message : "Could not remove"); },
  });
  if (q.isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!h) return <EmptyState title="Homework not found" />;
  const set = (sid: string, patch: Partial<Mark>) => setMarks((m) => ({ ...m, [sid]: { ...m[sid], ...patch } }));
  // Undo the teacher's check: back to what the family said.
  const reset = (sid: string) => set(sid, { status: h.roster.find((r) => r.student_id === sid)?.note ? "done" : "pending", remark: "" });

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", colorOf(h.subject_color).cell)}>{h.subject_name}</span>
            <span className="text-sm text-muted-foreground">{h.section_label}</span>
          </div>
          <h1 className="mt-2 text-xl font-bold">{h.title}</h1>
          {h.details && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{h.details}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Set {format(parseISO(h.assigned_on), "d MMM")} by {h.teacher ?? "—"} · due {format(parseISO(h.due_date), "EEEE d MMM")}</p>
        </div>
        {h.can_edit && <Button variant="ghost" className="text-destructive" onClick={() => setRemoving(true)}><Trash2 aria-hidden />Remove</Button>}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.status === "incomplete" ? v : { ...v, status: "checked" }])))}>
          <CheckCheck aria-hidden />Mark all checked
        </Button>
        <p className="text-sm text-muted-foreground">Parents and students see the status and your remark.</p>
      </div>
      <ul className="space-y-2 pb-4">
        {h.roster.map((r) => {
          const m = marks[r.student_id] ?? { status: r.status, remark: "" };
          return (
            <li key={r.student_id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="w-6 text-right text-sm text-muted-foreground tabular">{r.roll_no ?? "—"}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", STATE[m.status].cls)}>{STATE[m.status].label}</span>
                    {r.note && <span className="ml-2">Family: “{r.note}”</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant={m.status === "checked" ? "default" : "outline"} onClick={() => set(r.student_id, { status: "checked" })} aria-pressed={m.status === "checked"}><Check aria-hidden />Checked</Button>
                <Button size="sm" variant={m.status === "incomplete" ? "destructive" : "outline"} onClick={() => set(r.student_id, { status: "incomplete" })} aria-pressed={m.status === "incomplete"}><X aria-hidden />Incomplete</Button>
                <Button size="icon" variant="ghost" className="size-8" aria-label={`Undo for ${r.name}`} onClick={() => reset(r.student_id)}><RotateCcw aria-hidden /></Button>
              </div>
              {(m.status === "checked" || m.status === "incomplete") && (
                <Input value={m.remark} onChange={(e) => set(r.student_id, { remark: e.target.value })} maxLength={300} placeholder="Remark (optional)" aria-label={`Remark for ${r.name}`} className="h-8 sm:w-56" />
              )}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-4 z-30 flex items-center gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl backdrop-blur">
        <p className="text-sm">{Object.values(marks).filter((m) => m.status === "checked").length} checked · {Object.values(marks).filter((m) => m.status === "incomplete").length} incomplete</p>
        <Button className="ml-auto" disabled={!changed.length} onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving…"><Save aria-hidden />Save {changed.length ? `(${changed.length})` : ""}</Button>
      </div>
      <ConfirmDialog open={removing} onOpenChange={setRemoving} destructive pending={del.isPending} title="Remove this homework?" description="Families won't see it any more." confirmLabel="Remove" onConfirm={() => del.mutate()} />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PermissionGate permission="homework.manage">
      <Link href="/homework" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Homework</Link>
      <Detail id={id} />
    </PermissionGate>
  );
}
