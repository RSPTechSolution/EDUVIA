"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, format, isToday, startOfWeek } from "date-fns";
import { Check, ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { colorOf } from "@/components/timetable/grid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { LessonPlan } from "@/lib/api/types";
import { useClasses, useHomeworkTargets, useLessons, useSyllabus } from "@/lib/queries";
import { cn } from "@/lib/utils";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function LessonDialog({ lesson, day, open, onOpenChange }: { lesson: LessonPlan | null; day: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const targets = useHomeworkTargets(open);
  const classes = useClasses(open);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(day);
  const [topicId, setTopicId] = useState("none");
  const [title, setTitle] = useState("");
  const [objectives, setObjectives] = useState("");
  const [activities, setActivities] = useState("");
  const [resources, setResources] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setSectionId(lesson?.section_id ?? ""); setSubjectId(lesson?.subject_id ?? ""); setDate(lesson?.date ?? day);
    setTopicId(lesson?.topic_id ?? "none"); setTitle(lesson?.title ?? ""); setObjectives(lesson?.objectives ?? "");
    setActivities(lesson?.activities ?? ""); setResources(lesson?.resources ?? ""); setError(null);
  }, [open, lesson, day]);
  useEffect(() => {
    if (open && !lesson && !sectionId && targets.data?.length) { setSectionId(targets.data[0].section_id); setSubjectId(targets.data[0].subjects[0]?.id ?? ""); }
  }, [open, lesson, sectionId, targets.data]);
  const target = targets.data?.find((t) => t.section_id === sectionId);
  const classId = classes.data?.find((c) => c.sections.some((s) => s.id === sectionId))?.id ?? null;
  const syllabus = useSyllabus(open ? classId : null, open ? subjectId || null : null);

  const save = useMutation({
    mutationFn: () => {
      const body = { date, topic_id: topicId === "none" ? null : topicId, title, objectives: objectives || null, activities: activities || null, resources: resources || null };
      return lesson
        ? api(`/lesson-plans/${lesson.id}`, { method: "PATCH", body })
        : api("/lesson-plans", { method: "POST", body: { ...body, section_id: sectionId, subject_id: subjectId } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lessons"] }); toast.success(lesson ? "Lesson plan saved" : "Lesson planned"); onOpenChange(false); },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not save"),
  });
  const topics = syllabus.data?.topics ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{lesson ? "Edit lesson plan" : "Plan a lesson"}</DialogTitle>
          <DialogDescription>{lesson ? `${lesson.section_label} · ${lesson.subject_name}` : "For a class and subject you teach."}</DialogDescription>
        </DialogHeader>
        <form id="lesson-form" className="grid max-h-[60vh] gap-4 overflow-y-auto px-0.5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {!lesson && (
            <>
              <Field label="Class" required>
                {(a) => (
                  <Select value={sectionId || undefined} onValueChange={(v) => { const t = targets.data?.find((x) => x.section_id === v); setSectionId(String(v)); setSubjectId(t?.subjects[0]?.id ?? ""); setTopicId("none"); }}>
                    <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Class">{target?.section_label}</SelectValue></SelectTrigger>
                    <SelectContent className="max-h-72">{targets.data?.map((t) => <SelectItem key={t.section_id} value={t.section_id}>{t.section_label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </Field>
              <Field label="Subject" required>
                {(a) => (
                  <Select value={subjectId || undefined} onValueChange={(v) => { setSubjectId(String(v)); setTopicId("none"); }}>
                    <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Subject">{target?.subjects.find((s) => s.id === subjectId)?.name}</SelectValue></SelectTrigger>
                    <SelectContent>{target?.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </Field>
            </>
          )}
          <Field label="Date" required>{(a) => <Input {...a} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Syllabus topic" hint={topics.length ? "Marking the lesson taught ticks this topic off" : "No syllabus for this subject yet"}>
            {(a) => (
              <Select value={topicId} onValueChange={(v) => { setTopicId(String(v)); const t = topics.find((x) => x.id === v); if (t && !title) setTitle(t.title); }}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{topicId === "none" ? "None" : topics.find((t) => t.id === topicId)?.title ?? lesson?.topic_title}</SelectValue></SelectTrigger>
                <SelectContent className="max-h-72"><SelectItem value="none">None</SelectItem>{topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.unit ? `${t.unit} · ` : ""}{t.title}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Lesson" required className="sm:col-span-2">{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Adding fractions with like denominators" />}</Field>
          <Field label="Learning objectives" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="By the end, students can…" />}</Field>
          <Field label="Activities" className="sm:col-span-2">{(a) => <Textarea {...a} rows={3} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="Warm-up, explanation, practice, exit question" />}</Field>
          <Field label="Resources" className="sm:col-span-2">{(a) => <Input {...a} value={resources} onChange={(e) => setResources(e.target.value)} placeholder="Textbook p. 42, fraction strips" />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="lesson-form" disabled={!title.trim() || (!lesson && (!sectionId || !subjectId))} loading={save.isPending} loadingText="Saving…">
            {lesson ? "Save" : "Plan lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LessonCard({ l, onEdit, onRemove }: { l: LessonPlan; onEdit: () => void; onRemove: () => void }) {
  const qc = useQueryClient();
  const taught = useMutation({
    mutationFn: (done: boolean) => api(`/lesson-plans/${l.id}/taught`, { method: "POST", query: { done } }),
    onSuccess: (_, done) => { qc.invalidateQueries({ queryKey: ["lessons"] }); qc.invalidateQueries({ queryKey: ["syllabus"] }); toast.success(done ? (l.topic_title ? "Taught, and the topic is ticked off" : "Marked as taught") : "Marked as planned"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not update"),
  });
  const done = l.status === "taught";
  return (
    <li className={cn("rounded-xl border bg-card p-3.5", done && "bg-success/5")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", colorOf(l.subject_color).cell)}>{l.subject_name}</span>
        <span className="text-xs text-muted-foreground">{l.section_label}</span>
        {done && <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success"><Check className="size-3" aria-hidden />Taught</span>}
      </div>
      <p className="mt-1.5 font-medium">{l.title}</p>
      {l.topic_title && <p className="text-xs text-muted-foreground">Topic: {l.topic_title}</p>}
      {l.objectives && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{l.objectives}</p>}
      {l.activities && <p className="mt-1 text-sm whitespace-pre-line"><span className="font-medium">Activities: </span>{l.activities}</p>}
      {l.resources && <p className="mt-1 text-xs text-muted-foreground">Resources: {l.resources}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {l.teacher && <span className="mr-auto text-xs text-muted-foreground">{l.teacher}</span>}
        {l.can_edit && (
          <>
            <Button size="sm" variant={done ? "ghost" : "outline"} onClick={() => taught.mutate(!done)} loading={taught.isPending}>
              {done ? <><Undo2 aria-hidden />Not taught</> : <><Check aria-hidden />Mark taught</>}
            </Button>
            <Button size="icon" variant="ghost" aria-label={`Edit ${l.title}`} onClick={onEdit}><Pencil aria-hidden /></Button>
            <Button size="icon" variant="ghost" aria-label={`Remove ${l.title}`} onClick={onRemove}><Trash2 aria-hidden /></Button>
          </>
        )}
      </div>
    </li>
  );
}

export default function LessonPlansPage() {
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(week, i)), [week]);
  const q = useLessons(iso(days[0]), iso(days[5]));
  const [editing, setEditing] = useState<LessonPlan | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LessonPlan | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/lesson-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lessons"] }); setRemoving(null); toast.success("Lesson plan removed"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not remove"),
  });
  return (
    <PermissionGate permission="syllabus.manage">
      <PageHeader title="Lesson plans" description="Plan the week's lessons. Marking one taught ticks off its syllabus topic."
        actions={<Button onClick={() => setCreatingOn(iso(new Date()))}><Plus aria-hidden />Plan a lesson</Button>} />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeek((w) => addWeeks(w, -1))}><ChevronLeft aria-hidden /></Button>
        <p className="min-w-48 text-center font-medium">{format(days[0], "d MMM")} – {format(days[5], "d MMM yyyy")}</p>
        <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeek((w) => addWeeks(w, 1))}><ChevronRight aria-hidden /></Button>
        <Button variant="ghost" size="sm" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This week</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-72 rounded-xl" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => {
            const items = (q.data ?? []).filter((l) => l.date === iso(d));
            return (
              <section key={iso(d)} aria-label={format(d, "EEEE d MMMM")} className={cn("rounded-2xl border bg-muted/20 p-3", isToday(d) && "border-primary/50 bg-primary/5")}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">{format(d, "EEEE")} <span className="font-normal text-muted-foreground">{format(d, "d MMM")}</span></h2>
                  <Button size="icon" variant="ghost" aria-label={`Plan a lesson on ${format(d, "EEEE")}`} onClick={() => setCreatingOn(iso(d))}><Plus aria-hidden /></Button>
                </div>
                {items.length === 0 ? <p className="px-1 py-3 text-sm text-muted-foreground">Nothing planned</p> : (
                  <ul className="space-y-2">{items.map((l) => <LessonCard key={l.id} l={l} onEdit={() => setEditing(l)} onRemove={() => setRemoving(l)} />)}</ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {!q.isLoading && q.data?.length === 0 && (
        <EmptyState className="mt-4" title="No lessons planned this week" description="Plan a lesson for any day, and link it to a syllabus topic." action={<Button onClick={() => setCreatingOn(iso(new Date()))}><NotebookPen aria-hidden />Plan a lesson</Button>} />
      )}
      <LessonDialog lesson={editing} day={creatingOn ?? iso(new Date())} open={Boolean(editing) || Boolean(creatingOn)} onOpenChange={(o) => { if (!o) { setEditing(null); setCreatingOn(null); } }} />
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Remove “${removing?.title}”?`} description="The plan is deleted. Syllabus progress stays as it is." confirmLabel="Remove" onConfirm={() => removing && remove.mutate(removing.id)} />
    </PermissionGate>
  );
}
