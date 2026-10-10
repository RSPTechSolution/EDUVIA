"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { AlertTriangle, BookMarked, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { CoverageBar } from "@/components/academics/syllabus";
import { colorOf } from "@/components/timetable/grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { CoverageRow, SyllabusTopic, SyllabusView } from "@/lib/api/types";
import { useClasses, useCoverage, useSyllabus, useSyllabusSubjects } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : fallback);

function CoverageTab({ onOpen }: { onOpen: (classId: string, subjectId: string) => void }) {
  const q = useCoverage();
  const groups = useMemo(() => {
    const m = new Map<string, CoverageRow[]>();
    for (const r of q.data ?? []) m.set(r.section_label, [...(m.get(r.section_label) ?? []), r]);
    return [...m.entries()];
  }, [q.data]);
  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (!groups.length) {
    return <EmptyState className="rounded-2xl border bg-card" title="No syllabus yet" description="Open “Edit syllabus”, choose a class and subject, and paste the chapter list." />;
  }
  return (
    <div className="space-y-6">
      {groups.map(([label, rows]) => (
        <section key={label}>
          <h2 className="mb-3 font-heading text-lg font-bold">{label}</h2>
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <StaggerItem key={`${r.section_id}-${r.subject_id}`}>
                <button type="button" onClick={() => onOpen(r.class_id, r.subject_id)}
                  className="card-lift flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", colorOf(r.subject_color).cell)}>{r.subject_name}</span>
                    {r.behind > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-warning"><AlertTriangle className="size-3.5" aria-hidden />{r.behind} behind plan</span>
                    )}
                  </div>
                  <CoverageBar row={r} />
                  <p className="truncate text-xs text-muted-foreground">{r.last_topic ? `Last finished: ${r.last_topic}` : "Nothing finished yet"}</p>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ))}
    </div>
  );
}

function TopicDialog({ view, topic, open, onOpenChange }: { view: SyllabusView; topic: SyllabusTopic | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"one" | "many">("one");
  const [unit, setUnit] = useState("");
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setMode(topic || view.topics.length ? "one" : "many");
    setUnit(topic?.unit ?? ""); setTitle(topic?.title ?? ""); setMonth(topic?.planned_month ?? ""); setText(""); setError(null);
  }, [open, topic, view.topics.length]);
  const save = useMutation({
    mutationFn: async () => {
      if (topic) return api(`/syllabus/topics/${topic.id}`, { method: "PATCH", body: { unit: unit || null, title, planned_month: month || null } });
      if (mode === "many") return api("/syllabus/topics/bulk", { method: "POST", body: { class_id: view.class_id, subject_id: view.subject_id, text } });
      return api("/syllabus/topics", { method: "POST", body: { class_id: view.class_id, subject_id: view.subject_id, unit: unit || null, title, planned_month: month || null } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["syllabus"] });
      toast.success(topic ? "Topic saved" : mode === "many" ? "Topics added" : "Topic added");
      onOpenChange(false);
    },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{topic ? "Edit topic" : "Add topics"}</DialogTitle>
          <DialogDescription>{view.class_name} · {view.subject_name}</DialogDescription>
        </DialogHeader>
        {!topic && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "one" | "many")}>
            <TabsList><TabsTrigger value="one">One topic</TabsTrigger><TabsTrigger value="many">Paste a list</TabsTrigger></TabsList>
          </Tabs>
        )}
        <form id="topic-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {mode === "many" && !topic ? (
            <Field label="Topics" required className="sm:col-span-2" hint="One per line. Write “Unit: Topic” to group topics under a unit. Numbering is removed.">
              {(a) => <Textarea {...a} rows={9} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={"Number system: Integers\nNumber system: Fractions\nAlgebra: Simple equations"} />}
            </Field>
          ) : (
            <>
              <Field label="Topic" required className="sm:col-span-2">{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}</Field>
              <Field label="Unit or chapter">{(a) => <Input {...a} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={100} placeholder="Optional" />}</Field>
              <Field label="Planned for" hint="The month it should be finished">{(a) => <Input {...a} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
            </>
          )}
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="topic-form" disabled={mode === "many" && !topic ? !text.trim() : !title.trim()} loading={save.isPending} loadingText="Saving…">
            {topic ? "Save" : mode === "many" ? "Add topics" : "Add topic"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyllabusEditor({ classId, subjectId }: { classId: string; subjectId: string }) {
  const qc = useQueryClient();
  const q = useSyllabus(classId, subjectId);
  const [editing, setEditing] = useState<SyllabusTopic | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SyllabusTopic | null>(null);
  const toggle = useMutation({
    mutationFn: (v: { topic_id: string; section_id: string; done: boolean }) => api("/syllabus/progress", { method: "PUT", body: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["syllabus"] }),
    onError: (e) => toast.error(errText(e, "Could not update")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/syllabus/topics/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["syllabus"] }); setRemoving(null); toast.success("Topic removed"); },
    onError: (e) => toast.error(errText(e, "Could not remove")),
  });
  if (q.isLoading) return <Skeleton className="h-72 rounded-xl" />;
  const v = q.data;
  if (!v) return null;
  const thisMonth = format(new Date(), "yyyy-MM");
  let lastUnit: string | null | undefined;
  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold">{v.class_name} · {v.subject_name}</h2>
          <p className="text-sm text-muted-foreground">{v.topics.length} topics. Tick a topic when a section finishes it.</p>
        </div>
        {v.can_edit_topics && <Button onClick={() => setAdding(true)}><ListPlus aria-hidden />Add topics</Button>}
      </div>
      {v.topics.length === 0 ? (
        <EmptyState className="py-10" title="No topics yet" description="Paste the chapter list from the textbook to get started."
          action={v.can_edit_topics && <Button onClick={() => setAdding(true)}><Plus aria-hidden />Add topics</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Syllabus topics and which sections have finished them</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">Topic</th>
                <th scope="col" className="px-2 py-2 font-medium">Planned</th>
                {v.sections.map((s) => <th key={s.id} scope="col" className="px-2 py-2 text-center font-medium">Section {s.name}</th>)}
                {v.can_edit_topics && <th scope="col" className="w-20"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {v.topics.map((t) => {
                const header = t.unit !== lastUnit && t.unit;
                lastUnit = t.unit;
                const late = t.planned_month && t.planned_month < thisMonth && v.sections.some((s) => !t.done_sections.includes(s.id));
                return [
                  header ? (
                    <tr key={`${t.id}-unit`} className="bg-muted/40"><th colSpan={v.sections.length + 3} scope="colgroup" className="px-4 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.unit}</th></tr>
                  ) : null,
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{t.title}</td>
                    <td className={cn("px-2 py-2.5 text-xs whitespace-nowrap", late ? "font-medium text-warning" : "text-muted-foreground")}>
                      {t.planned_month ? format(parseISO(`${t.planned_month}-01`), "MMM yyyy") : "—"}
                    </td>
                    {v.sections.map((s) => {
                      const done = t.done_sections.includes(s.id);
                      return (
                        <td key={s.id} className="px-2 py-2.5 text-center">
                          <Checkbox
                            checked={done}
                            disabled={!s.editable || toggle.isPending}
                            onCheckedChange={(c) => toggle.mutate({ topic_id: t.id, section_id: s.id, done: Boolean(c) })}
                            aria-label={`${t.title} finished in section ${s.name}`}
                            title={done ? `Finished ${format(parseISO(t.completed_on[s.id]), "d MMM")}` : undefined}
                            className="mx-auto"
                          />
                        </td>
                      );
                    })}
                    {v.can_edit_topics && (
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${t.title}`} onClick={() => setEditing(t)}><Pencil aria-hidden /></Button>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${t.title}`} onClick={() => setRemoving(t)}><Trash2 aria-hidden /></Button>
                      </td>
                    )}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      <TopicDialog view={v} topic={editing} open={adding || Boolean(editing)} onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null); } }} />
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Remove “${removing?.title}”?`} description="Its progress in every section is removed too." confirmLabel="Remove"
        onConfirm={() => removing && remove.mutate(removing.id)} />
    </div>
  );
}

function EditTab({ classId, subjectId, setClassId, setSubjectId }: {
  classId: string | null; subjectId: string | null; setClassId: (v: string | null) => void; setSubjectId: (v: string | null) => void;
}) {
  const classes = useClasses();
  const subjects = useSyllabusSubjects(classId);
  useEffect(() => {
    if (subjects.data && subjectId && !subjects.data.some((s) => s.id === subjectId)) setSubjectId(null);
  }, [subjects.data, subjectId, setSubjectId]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Class" className="w-56">
          {(a) => (
            <Select value={classId ?? undefined} onValueChange={(v) => { setClassId(String(v)); setSubjectId(null); }}>
              <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Choose a class">{classes.data?.find((c) => c.id === classId)?.name}</SelectValue></SelectTrigger>
              <SelectContent className="max-h-72">{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Field>
      </div>
      {classId && (
        // One scrolling row on phones (wrapping from tablet width), so the page doesn't move as subjects load.
        <div className="flex min-h-[30px] max-w-full gap-1.5 overflow-x-auto sm:flex-wrap" role="group" aria-label="Subject">
          {subjects.isLoading && <Skeleton className="h-[30px] w-64 rounded-full" />}
          {subjects.data?.length === 0 && <p className="text-sm text-muted-foreground">You don&apos;t teach any subject in this class.</p>}
          {subjects.data?.map((s) => (
            <button key={s.id} type="button" aria-pressed={subjectId === s.id} onClick={() => setSubjectId(s.id)}
              className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition", subjectId === s.id ? colorOf(s.color).cell : "text-muted-foreground hover:bg-muted")}>
              <span className={cn("size-2 rounded-full", colorOf(s.color).dot)} />{s.name}
              <span className="text-xs opacity-70">{s.topics}</span>
            </button>
          ))}
        </div>
      )}
      {classId && subjectId ? <SyllabusEditor classId={classId} subjectId={subjectId} /> : (
        <EmptyState className="rounded-2xl border bg-card" title="Choose a class and subject" description="Then add the chapter list and tick topics off as each section finishes them." />
      )}
    </div>
  );
}

export default function SyllabusPage() {
  const [tab, setTab] = useState<"coverage" | "edit">("coverage");
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  return (
    <PermissionGate permission="syllabus.manage">
      <PageHeader title="Syllabus" description="Chapters for each class and subject, and how far every section has got." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "coverage" | "edit")} className="mb-5">
        <TabsList>
          <TabsTrigger value="coverage"><BookMarked aria-hidden />Coverage</TabsTrigger>
          <TabsTrigger value="edit"><Pencil aria-hidden />Edit syllabus</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "coverage" ? (
        <CoverageTab onOpen={(c, s) => { setClassId(c); setSubjectId(s); setTab("edit"); }} />
      ) : (
        <EditTab classId={classId} subjectId={subjectId} setClassId={setClassId} setSubjectId={setSubjectId} />
      )}
    </PermissionGate>
  );
}
