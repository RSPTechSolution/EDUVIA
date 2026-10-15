"use client";

import { AttachmentChips } from "@/components/common/files";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { BookOpen, Check, CheckCircle2, Circle, MessageSquareText, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion/motion";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { FamilyIllustration } from "@/components/illustrations";
import { colorOf } from "@/components/timetable/grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { MyHomework } from "@/lib/api/types";
import { useMyHomework } from "@/lib/queries";
import { patchLists } from "@/lib/optimistic";
import { cn } from "@/lib/utils";

const dueLabel = (d: string) => { const x = parseISO(d); return isToday(x) ? "Due today" : isTomorrow(x) ? "Due tomorrow" : `Due ${format(x, "EEE d MMM")}`; };

function Item({ h }: { h: MyHomework }) {
  const qc = useQueryClient();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(h.note ?? "");
  const toggle = useMutation({
    mutationFn: (done: boolean) => api(`/homework/${h.id}/done`, { method: "POST", body: { student_id: h.student_id, done, note: note || null } }),
    onMutate: (done) => patchLists<MyHomework>(qc, ["homework", "my"], (x) => x.id === h.id && x.student_id === h.student_id, { status: done ? "done" : "pending" }),
    onSuccess: (_d, done) => { setNoting(false); toast.success(done ? "Marked as done" : "Marked as not done"); },
    onError: (e, _v, undo) => { undo?.(); toast.error(e instanceof ApiError ? e.message : "Could not update"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["homework", "my"] }),
  });
  const teacherDone = h.status === "checked" || h.status === "incomplete";
  const Icon = h.status === "checked" ? CheckCircle2 : h.status === "incomplete" ? XCircle : h.status === "done" ? CheckCircle2 : Circle;
  return (
    <motion.li layout className={cn("rounded-xl border bg-card p-4", h.overdue && "border-destructive/40")}>
      <div className="flex items-start gap-3">
        <button type="button" disabled={teacherDone} onClick={() => toggle.mutate(h.status !== "done")}
          aria-label={h.status === "done" ? "Mark as not done" : "Mark as done"} aria-pressed={h.status !== "pending"}
          className={cn("mt-0.5 rounded-full transition active:scale-90 disabled:cursor-default",
            h.status === "checked" ? "text-success" : h.status === "incomplete" ? "text-destructive" : h.status === "done" ? "text-info" : "text-muted-foreground hover:text-primary")}>
          <Icon className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", colorOf(h.subject_color).cell)}>{h.subject_name}</span>
            <span className={cn("text-xs font-medium", h.overdue ? "text-destructive" : "text-muted-foreground")}>{h.overdue ? `Overdue · was due ${format(parseISO(h.due_date), "EEE d MMM")}` : dueLabel(h.due_date)}</span>
          </div>
          <p className={cn("mt-1 font-medium", h.status !== "pending" && "text-muted-foreground")}>{h.title}</p>
          {h.details && <p className="mt-0.5 text-sm text-muted-foreground">{h.details}</p>}
          {!!h.attachments?.length && <div className="mt-1.5"><AttachmentChips files={h.attachments} /></div>}
          <p className="mt-1 text-xs text-muted-foreground">
            {h.teacher ?? "Teacher"} · {h.status === "checked" ? "Checked by the teacher" : h.status === "incomplete" ? "Teacher marked it incomplete" : h.status === "done" ? "You marked it done" : "Not done yet"}
          </p>
          {h.remark && <p className="mt-1 flex items-center gap-1.5 text-sm"><MessageSquareText className="size-4 text-primary" aria-hidden />“{h.remark}”</p>}
          <AnimatePresence>
            {noting && (
              <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 flex gap-2 overflow-hidden"
                onSubmit={(e) => { e.preventDefault(); toggle.mutate(true); }}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the teacher (optional)" maxLength={300} aria-label="Note for the teacher" className="h-8" />
                <Button size="sm" type="submit" loading={toggle.isPending} loadingText="Saving…"><Check aria-hidden />Done</Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        {h.status === "pending" && !noting && <Button size="sm" variant="outline" onClick={() => setNoting(true)}>Add a note</Button>}
      </div>
    </motion.li>
  );
}

export default function MyHomeworkPage() {
  const q = useMyHomework();
  const [child, setChild] = useState<string | null>(null);
  const kids = useMemo(() => [...new Map((q.data ?? []).map((h) => [h.student_id, h.student_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [q.data]);
  const current = child ?? kids[0]?.[0];
  const items = (q.data ?? []).filter((h) => h.student_id === current);
  const today = format(new Date(), "yyyy-MM-dd");
  const groups = [
    ["To do", items.filter((h) => h.status === "pending" && h.due_date >= today)],
    ["Overdue", items.filter((h) => h.overdue)],
    ["Done", items.filter((h) => h.status !== "pending").sort((a, b) => b.due_date.localeCompare(a.due_date))],
  ] as const;
  return (
    <>
      <PageHeader title="Homework" description="What's due, and what the teacher has checked." />
      {q.isLoading ? <Skeleton className="h-80 rounded-2xl" /> : !items.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<FamilyIllustration />} title="No homework" description="Nothing has been set in the last three weeks." />
      ) : (
        <>
          {kids.length > 1 && (
            <div role="tablist" aria-label="Child" className="mb-5 flex flex-wrap gap-2">
              {kids.map(([id, name]) => (
                <button key={id} role="tab" type="button" aria-selected={id === current} onClick={() => setChild(id)}
                  className={cn("rounded-xl border px-4 py-2 text-sm font-semibold transition", id === current ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40")}>
                  {name}<span className="ml-2 text-xs font-normal text-muted-foreground">{(q.data ?? []).filter((h) => h.student_id === id && h.status === "pending").length} to do</span>
                </button>
              ))}
            </div>
          )}
          {groups.map(([label, list]) => list.length > 0 && (
            <section key={label} className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold"><BookOpen className="size-5 text-primary" aria-hidden />{label} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
              <ul className="space-y-2">{list.map((h) => <Item key={`${h.id}${h.student_id}`} h={h} />)}</ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
