"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { CalendarCheck, Handshake, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useCan, useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { PtmEvent } from "@/lib/api/types";
import { useClasses, usePtmEvents, usePtmSchedule, usePtmSlots } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const classes = useClasses(open);
  const [f, setF] = useState({ title: "Parent-teacher meeting", date: format(addDays(new Date(), 7), "yyyy-MM-dd"), start_time: "09:00", end_time: "12:00", slot_minutes: "10", location: "" });
  const [sections, setSections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setSections(classes.data?.flatMap((c) => c.sections.map((s) => s.id)) ?? []); setError(null); } }, [open, classes.data]);
  const save = useMutation({
    mutationFn: () => api("/ptm", { method: "POST", body: { ...f, slot_minutes: Number(f.slot_minutes), location: f.location || null, section_ids: sections } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptm"] }); toast.success("Meeting created. Families can book a slot now."); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not create")),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>New parent-teacher meeting</DialogTitle><DialogDescription>Each family books a slot with their child&apos;s class teacher.</DialogDescription></DialogHeader>
        <form id="ptm-form" className="grid max-h-[62vh] gap-4 overflow-y-auto px-0.5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Title" required className="sm:col-span-2">{(a) => <Input {...a} value={f.title} onChange={set("title")} maxLength={200} />}</Field>
          <Field label="Date" required>{(a) => <Input {...a} type="date" value={f.date} onChange={set("date")} />}</Field>
          <Field label="Minutes per family">{(a) => <Input {...a} type="number" min={5} max={60} value={f.slot_minutes} onChange={set("slot_minutes")} />}</Field>
          <Field label="From">{(a) => <Input {...a} type="time" value={f.start_time} onChange={set("start_time")} />}</Field>
          <Field label="To">{(a) => <Input {...a} type="time" value={f.end_time} onChange={set("end_time")} />}</Field>
          <Field label="Where" className="sm:col-span-2">{(a) => <Input {...a} value={f.location} onChange={set("location")} placeholder="e.g. Each class's own room" maxLength={200} />}</Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Classes ({sections.length})</legend>
            <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-2 overflow-y-auto rounded-lg border p-2">
              {classes.data?.flatMap((c) => c.sections.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox checked={sections.includes(s.id)} onCheckedChange={(v) => setSections((x) => (v ? [...x, s.id] : x.filter((y) => y !== s.id)))} />{c.name} – {s.name}</label>
              )))}
            </div>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="ptm-form" disabled={!sections.length || !f.title.trim()} loading={save.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FamilySlots({ event }: { event: PtmEvent }) {
  const qc = useQueryClient();
  const q = usePtmSlots(event.id);
  const book = useMutation({
    mutationFn: (v: { student_id: string; slot: string }) => api(`/ptm/${event.id}/book`, { method: "POST", body: v }),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["ptm"] }); toast.success(`Booked for ${v.slot}`); },
    onError: (e) => { qc.invalidateQueries({ queryKey: ["ptm", "slots"] }); toast.error(errText(e, "Could not book")); },
  });
  const cancel = useMutation({
    mutationFn: (sid: string) => api(`/ptm/${event.id}/book/${sid}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptm"] }); toast.success("Booking cancelled"); },
  });
  if (q.isLoading) return <Skeleton className="h-24" />;
  return (
    <div className="space-y-4">
      {q.data?.map((c) => (
        <div key={c.student_id}>
          <p className="text-sm font-medium">{c.student_name} · with {c.teacher_name ?? "the class teacher (not assigned yet)"}</p>
          {c.booking ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm"><CalendarCheck className="size-4 text-success" aria-hidden />Booked at <span className="font-semibold">{c.booking}</span>
              {!event.past && <Button variant="ghost" size="sm" onClick={() => cancel.mutate(c.student_id)}>Cancel booking</Button>}</p>
          ) : null}
          {!event.past && c.slots.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Times for ${c.student_name}`}>
              {c.slots.map((s) => (
                <button key={s.time} type="button" disabled={!s.free && !s.mine} aria-pressed={s.mine} onClick={() => book.mutate({ student_id: c.student_id, slot: s.time })}
                  className={cn("rounded-md border px-2.5 py-1 text-xs tabular transition", s.mine ? "border-primary bg-primary text-primary-foreground" : s.free ? "hover:border-primary hover:bg-primary/5" : "cursor-not-allowed text-muted-foreground line-through opacity-50")}>
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TeacherSchedule({ event }: { event: PtmEvent }) {
  const q = usePtmSchedule(event.id);
  const rows = q.data?.filter((r) => r.student_name) ?? [];
  if (q.isLoading) return <Skeleton className="h-24" />;
  return rows.length === 0 ? <p className="text-sm text-muted-foreground">No families have booked with you yet.</p> : (
    <ul className="divide-y rounded-lg border text-sm">
      {rows.map((r) => (
        <li key={r.time} className="flex flex-wrap gap-x-4 px-3 py-2"><span className="w-12 font-semibold tabular">{r.time}</span><span className="font-medium">{r.student_name}</span>
          <span className="text-muted-foreground">{r.parent}{r.phone ? ` · ${r.phone}` : ""}</span>{r.note && <span className="w-full text-xs text-muted-foreground">“{r.note}”</span>}</li>
      ))}
    </ul>
  );
}

export default function PtmPage() {
  const me = useSession();
  const can = useCan();
  const qc = useQueryClient();
  const q = usePtmEvents();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<PtmEvent | null>(null);
  const family = me.role === "parent" || me.role === "student";
  const remove = useMutation({
    mutationFn: (id: string) => api(`/ptm/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptm"] }); setRemoving(null); toast.success("Meeting removed"); },
  });
  return (
    <>
      <PageHeader title="Parent-teacher meetings" description={family ? "Book a time to meet your child's class teacher." : "Meeting days and who has booked a slot."}
        actions={can("ptm.manage") && <Button onClick={() => setCreating(true)}><Plus aria-hidden />New meeting</Button>} />
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Handshake className="size-12 text-muted-foreground/60" aria-hidden />} title="No meetings scheduled" />
      ) : (
        <ul className="space-y-4">
          {q.data.map((e) => (
            <li key={e.id} className={cn("rounded-2xl border bg-card p-5", e.past && "opacity-70")}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{format(parseISO(e.date), "EEEE d MMMM")} · {e.start_time}–{e.end_time} · {e.slot_minutes} min each{e.location ? ` · ${e.location}` : ""}</p>
                  {!family && <p className="text-xs text-muted-foreground">{e.sections_label} · {e.booked} of {e.slots} slots booked</p>}
                </div>
                {can("ptm.manage") && <Button variant="ghost" size="icon" aria-label={`Remove ${e.title}`} onClick={() => setRemoving(e)}><Trash2 aria-hidden /></Button>}
              </div>
              <div className="mt-4">{family ? <FamilySlots event={e} /> : <TeacherSchedule event={e} />}</div>
            </li>
          ))}
        </ul>
      )}
      {can("ptm.manage") && <CreateDialog open={creating} onOpenChange={setCreating} />}
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Remove “${removing?.title}”?`} description="All bookings for it are cancelled." confirmLabel="Remove" onConfirm={() => removing && remove.mutate(removing.id)} />
    </>
  );
}
