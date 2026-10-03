"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Clock, Coffee, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { COLOR_NAMES, DAYS, DAY_NAMES, colorOf, formatTime, slotKey } from "@/components/timetable/grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api/client";
import type { Period, Subject, TeacherInfo } from "@/lib/api/types";
import { initials } from "@/lib/format";
import { usePeriods, useSubjects, useTimetableTeachers } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errorText = (e: unknown, fallback: string) => e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : fallback;

// ---- subjects -------------------------------------------------------------------------------

function SubjectDialog({ open, onOpenChange, subject }: { open: boolean; onOpenChange: (o: boolean) => void; subject: Subject | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("blue");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? ""); setCode(subject?.code ?? ""); setColor(subject?.color ?? "blue"); setError(null);
  }, [open, subject]);
  const save = useMutation({
    mutationFn: () => api(subject ? `/timetable/subjects/${subject.id}` : "/timetable/subjects", {
      method: subject ? "PATCH" : "POST", body: { name, code: code || null, color },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timetable"] }); onOpenChange(false); toast.success(subject ? "Subject updated" : "Subject added"); },
    onError: (e) => setError(errorText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{subject ? "Edit subject" : "Add a subject"}</DialogTitle><DialogDescription>The colour is used on every timetable.</DialogDescription></DialogHeader>
        <form id="subject-form" className="grid gap-4 sm:grid-cols-[1fr_7rem]" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required error={error ?? undefined}>{(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}</Field>
          <Field label="Code">{(a) => <Input {...a} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} className="font-mono" />}</Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {COLOR_NAMES.map((c) => (
                <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)}
                  className={cn("size-8 rounded-full outline-none ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring", colorOf(c).dot, color === c ? "ring-2 ring-foreground scale-110" : "hover:scale-105")} />
              ))}
            </div>
          </fieldset>
          <div className={cn("rounded-lg border px-3 py-2 sm:col-span-2", colorOf(color).cell)}>
            <p className="text-sm font-semibold">{name || "Subject"}</p><p className="text-xs opacity-80">Preview on the timetable</p>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="subject-form" disabled={!name.trim()} loading={save.isPending} loadingText="Saving…">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectsTab() {
  const subjects = useSubjects();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ open: boolean; subject: Subject | null }>({ open: false, subject: null });
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api(`/timetable/subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timetable"] }); setDeleting(null); toast.success("Subject deleted"); },
    onError: (e) => { setDeleting(null); toast.error(errorText(e, "Could not delete")); },
  });
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing({ open: true, subject: null })}><Plus aria-hidden />Add subject</Button></div>
      {!subjects.data ? <Skeleton className="h-64 rounded-xl" /> : (
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {subjects.data.map((s) => (
            <StaggerItem key={s.id}>
              <div className={cn("card-lift group relative rounded-xl border p-4", colorOf(s.color).cell)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    {s.code && <p className="font-mono text-xs opacity-70">{s.code}</p>}
                  </div>
                  <div className="flex gap-0.5 opacity-70 group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Edit ${s.name}`} onClick={() => setEditing({ open: true, subject: s })}><Pencil aria-hidden /></Button>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}><Trash2 aria-hidden /></Button>
                  </div>
                </div>
                <p className="mt-3 flex gap-4 text-xs opacity-80">
                  <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden />{s.teacher_count} teachers</span>
                  <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{s.periods_per_week} periods/wk</span>
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <SubjectDialog open={editing.open} subject={editing.subject} onOpenChange={(o) => setEditing((x) => ({ ...x, open: o }))} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} destructive pending={del.isPending}
        title={`Delete ${deleting?.name}?`} description="Subjects used in a timetable can't be deleted." confirmLabel="Delete"
        onConfirm={() => deleting && del.mutate(deleting.id)} />
    </>
  );
}

// ---- bell schedule --------------------------------------------------------------------------

type Row = { key: string; id?: string; name: string; start_time: string; end_time: string; is_break: boolean };
const hhmm = (t: string) => t.slice(0, 5);
const addMinutes = (t: string, m: number) => {
  const [h, mm] = t.split(":").map(Number);
  const total = Math.min(h * 60 + mm + m, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

function BellTab() {
  const periods = usePeriods();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (periods.data) setRows(periods.data.map((p) => ({ key: p.id, id: p.id, name: p.name, start_time: hhmm(p.start_time), end_time: hhmm(p.end_time), is_break: p.is_break })));
  }, [periods.data]);
  const removed = (periods.data ?? []).filter((p) => !rows.some((r) => r.id === p.id));
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (is_break: boolean) => setRows((rs) => {
    const last = rs.at(-1)?.end_time ?? "08:00";
    const n = rs.filter((r) => !r.is_break).length + 1;
    return [...rs, { key: crypto.randomUUID(), name: is_break ? "Break" : `Period ${n}`, start_time: last, end_time: addMinutes(last, is_break ? 15 : 40), is_break }];
  });
  const save = useMutation({
    mutationFn: () => api<Period[]>("/timetable/periods", { method: "PUT", body: { periods: rows.map((r) => ({ id: r.id, name: r.name, start_time: r.start_time, end_time: r.end_time, is_break: r.is_break })) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timetable"] }); setConfirm(false); setError(null); toast.success("Bell schedule saved"); },
    onError: (e) => { setConfirm(false); setError(errorText(e, "Could not save")); },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bell schedule</CardTitle>
        <CardDescription>The same periods run Monday to Saturday. Breaks appear on every timetable but can&apos;t have lessons.</CardDescription>
      </CardHeader>
      <CardContent>
        {!periods.data ? <Skeleton className="h-72" /> : (
          <>
            <ol className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className={cn("grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto_auto]", r.is_break && "bg-muted/40")}>
                  <div className="flex items-center gap-2">
                    {r.is_break ? <Coffee className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />}
                    <Input aria-label="Period name" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} className="h-8" />
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 sm:order-last" aria-label={`Remove ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 aria-hidden /></Button>
                  <Input aria-label={`${r.name} starts`} type="time" value={r.start_time} onChange={(e) => update(r.key, { start_time: e.target.value })} className="h-8" />
                  <Input aria-label={`${r.name} ends`} type="time" value={r.end_time} onChange={(e) => update(r.key, { end_time: e.target.value })} className="h-8" />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={r.is_break} onCheckedChange={(v) => update(r.key, { is_break: v })} />Break</label>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => add(false)}><Plus aria-hidden />Period</Button>
              <Button variant="outline" size="sm" onClick={() => add(true)}><Coffee aria-hidden />Break</Button>
            </div>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-3 border-t pt-4">
              {removed.length > 0 && <p className="text-xs text-warning">Removing {removed.map((p) => p.name).join(", ")} deletes the lessons in {removed.length > 1 ? "them" : "it"}.</p>}
              <Button disabled={!rows.length} loading={save.isPending} loadingText="Saving…" onClick={() => (removed.length ? setConfirm(true) : save.mutate())}>Save schedule</Button>
            </div>
          </>
        )}
      </CardContent>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} destructive pending={save.isPending}
        title="Remove periods and their lessons?" description={`${removed.map((p) => p.name).join(", ")} will be removed from every class's timetable.`}
        confirmLabel="Save and remove" onConfirm={() => save.mutate()} />
    </Card>
  );
}

// ---- teachers -------------------------------------------------------------------------------

function TeacherSheet({ teacher, subjects, periods, onClose }: { teacher: TeacherInfo | null; subjects: Subject[]; periods: Period[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!teacher) return;
    setPicked(new Set(teacher.subject_ids));
    setBlocked(new Set(teacher.unavailable.map((u) => slotKey(u.day, u.period_id))));
  }, [teacher]);
  const lessons = periods.filter((p) => !p.is_break);
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  const save = useMutation({
    mutationFn: async () => {
      await api(`/timetable/teachers/${teacher!.id}/subjects`, { method: "PUT", body: { subject_ids: [...picked] } });
      await api(`/timetable/teachers/${teacher!.id}/unavailability`, {
        method: "PUT", body: { slots: [...blocked].map((k) => { const [d, p] = k.split(":"); return { day: Number(d), period_id: p }; }) },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["timetable"] }); toast.success(`Saved for ${teacher?.full_name}`); onClose(); },
    onError: (e) => toast.error(errorText(e, "Could not save")),
  });

  return (
    <Sheet open={Boolean(teacher)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{teacher?.full_name}</SheetTitle>
          <SheetDescription>{teacher?.designation ?? "Teacher"} · {teacher?.periods_per_week} periods a week</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4">
          <section>
            <h3 className="mb-1 text-sm font-semibold">Can teach</h3>
            <p className="mb-3 text-xs text-muted-foreground">Qualified teachers are suggested first when filling a slot.</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const on = picked.has(s.id);
                return (
                  <button key={s.id} type="button" aria-pressed={on} onClick={() => setPicked((p) => toggle(p, s.id))}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition", on ? colorOf(s.color).cell : "text-muted-foreground hover:bg-muted")}>
                    <span className={cn("size-2 rounded-full", colorOf(s.color).dot)} />{s.name}
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <h3 className="mb-1 text-sm font-semibold">Weekly availability</h3>
            <p className="mb-3 text-xs text-muted-foreground">Tap a slot to mark it unavailable (part-time days, admin duty). Click a day to toggle all of it.</p>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="w-20" />
                    {DAYS.map((d, i) => {
                      const all = lessons.every((p) => blocked.has(slotKey(i + 1, p.id)));
                      return (
                        <th key={d} scope="col">
                          <button type="button" className="w-full rounded-md py-1 font-semibold hover:bg-muted" aria-label={`${all ? "Mark available" : "Mark unavailable"} all of ${DAY_NAMES[i]}`}
                            onClick={() => setBlocked((b) => { const n = new Set(b); for (const p of lessons) { const k = slotKey(i + 1, p.id); if (all) n.delete(k); else n.add(k); } return n; })}>
                            {d}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="text-left font-normal text-muted-foreground">{p.name}<span className="block text-[10px]">{formatTime(p.start_time)}</span></th>
                      {DAYS.map((_, i) => {
                        const k = slotKey(i + 1, p.id);
                        const off = blocked.has(k);
                        return (
                          <td key={k}>
                            <button type="button" aria-pressed={off} aria-label={`${DAY_NAMES[i]} ${p.name}: ${off ? "unavailable" : "available"}`} onClick={() => setBlocked((b) => toggle(b, k))}
                              className={cn("h-8 w-full rounded-md border text-[10px] font-medium transition active:scale-95", off ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success hover:bg-success/20")}>
                              {off ? "Off" : "✓"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <SheetFooter>
          <Button onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving…">Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TeachersTab() {
  const teachers = useTimetableTeachers();
  const subjects = useSubjects();
  const periods = usePeriods();
  const [editing, setEditing] = useState<TeacherInfo | null>(null);
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(subjects.data?.map((s) => [s.id, s])), [subjects.data]);
  const max = Math.max(36, ...(teachers.data?.map((t) => t.periods_per_week) ?? []));
  const list = teachers.data?.filter((t) => t.full_name.toLowerCase().includes(q.toLowerCase())) ?? [];

  return (
    <>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teachers" aria-label="Search teachers" className="mb-4 h-9 sm:max-w-xs" />
      {!teachers.data ? <Skeleton className="h-96 rounded-xl" /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <li key={t.id} className="card-lift flex items-center gap-3 rounded-xl border bg-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(t.full_name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/timetable?tab=teacher&teacher=${t.id}`} className="truncate font-medium hover:text-primary hover:underline">{t.full_name}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">{t.periods_per_week} / wk</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className={cn("h-full rounded-full", t.periods_per_week > 36 ? "bg-warning" : "bg-primary")} style={{ width: `${(t.periods_per_week / max) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.subject_ids.map((id) => byId.get(id)).filter(Boolean).map((s) => (
                    <span key={s!.id} className={cn("rounded-full border px-2 py-0.5 text-[11px]", colorOf(s!.color).cell)}>{s!.name}</span>
                  ))}
                  {t.unavailable.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t.unavailable.length} slots off</span>}
                  {!t.subject_ids.length && <span className="text-[11px] text-warning">No subjects set</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Edit ${t.full_name}`} onClick={() => setEditing(t)}><Pencil aria-hidden /></Button>
            </li>
          ))}
        </ul>
      )}
      <TeacherSheet teacher={editing} subjects={subjects.data ?? []} periods={periods.data ?? []} onClose={() => setEditing(null)} />
    </>
  );
}

export default function Page() {
  const [tab, setTab] = useState("subjects");
  return (
    <PermissionGate permission="timetable.manage">
      <Link href="/timetable" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Timetable</Link>
      <PageHeader title="Timetable setup" description="Subjects, the school day, and what each teacher can teach and when." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-5">
        <TabsList>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="bell">Bell schedule</TabsTrigger>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "subjects" && <SubjectsTab />}
      {tab === "bell" && <BellTab />}
      {tab === "teachers" && <TeachersTab />}
    </PermissionGate>
  );
}
