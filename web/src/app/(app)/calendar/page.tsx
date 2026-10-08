"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { CalendarEvent } from "@/lib/api/types";
import { useCalendar } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Kind = CalendarEvent["kind"];
const KINDS: Record<Kind, { label: string; chip: string; dot: string }> = {
  holiday: { label: "Holiday", chip: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  vacation: { label: "Vacation", chip: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
  event: { label: "Event", chip: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
  exam: { label: "Exam", chip: "bg-info/10 text-info border-info/20", dot: "bg-info" },
  ptm: { label: "Parent-teacher meeting", chip: "bg-success/10 text-success border-success/20", dot: "bg-success" },
};
const iso = (d: Date) => format(d, "yyyy-MM-dd");

function EventDialog({ event, day, open, onOpenChange }: { event: CalendarEvent | null; day: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", kind: "event" as Kind, start_date: day, end_date: day, description: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setF(event ? { title: event.title, kind: event.kind, start_date: event.start_date, end_date: event.end_date, description: event.description ?? "" }
               : { title: "", kind: "event", start_date: day, end_date: day, description: "" });
    setError(null);
  }, [open, event, day]);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, description: f.description || null };
      return event ? api(`/calendar/${event.id}`, { method: "PUT", body }) : api("/calendar", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(event ? "Saved" : f.kind === "holiday" || f.kind === "vacation" ? "Added. Attendance is closed on those days." : "Added to the calendar");
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not save"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit" : "Add to the calendar"}</DialogTitle>
          <DialogDescription>Holidays and vacations close attendance. Everyone at school sees the calendar.</DialogDescription>
        </DialogHeader>
        <form id="event-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Title" required className="sm:col-span-2">{(a) => <Input {...a} value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} maxLength={200} placeholder="e.g. Diwali vacation" />}</Field>
          <Field label="Type" className="sm:col-span-2">
            {(a) => (
              <Select value={f.kind} onValueChange={(v) => setF((x) => ({ ...x, kind: v as Kind }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{KINDS[f.kind].label}</SelectValue></SelectTrigger>
                <SelectContent>{(Object.keys(KINDS) as Kind[]).map((k) => <SelectItem key={k} value={k}>{KINDS[k].label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="From" required>{(a) => <Input {...a} type="date" value={f.start_date} onChange={(e) => setF((x) => ({ ...x, start_date: e.target.value, end_date: x.end_date < e.target.value ? e.target.value : x.end_date }))} />}</Field>
          <Field label="To" required>{(a) => <Input {...a} type="date" value={f.end_date} min={f.start_date} onChange={(e) => setF((x) => ({ ...x, end_date: e.target.value }))} />}</Field>
          <Field label="Details" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="event-form" disabled={!f.title.trim()} loading={save.isPending} loadingText="Saving…">{event ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarPage() {
  const can = useCan();
  const manage = can("calendar.manage");
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const q = useCalendar(iso(gridStart), iso(gridEnd));
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart.getTime(), gridEnd.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [addingOn, setAddingOn] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CalendarEvent | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/calendar/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); setRemoving(null); toast.success("Removed"); },
  });
  const events = q.data ?? [];
  const on = (d: Date) => events.filter((e) => e.start_date <= iso(d) && e.end_date >= iso(d));
  const monthEnd = iso(endOfMonth(month));
  const upcoming = events.filter((e) => e.start_date <= monthEnd && e.end_date >= iso(month));

  return (
    <>
      <PageHeader title="School calendar" description="Holidays, vacations, exams, events and parent-teacher meetings."
        actions={manage && <Button onClick={() => setAddingOn(iso(new Date()))}><CalendarPlus aria-hidden />Add</Button>} />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft aria-hidden /></Button>
        <h2 className="min-w-40 text-center font-heading text-lg font-bold" aria-live="polite">{format(month, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight aria-hidden /></Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
        <div className="ml-auto hidden flex-wrap gap-3 text-xs text-muted-foreground md:flex">
          {(Object.keys(KINDS) as Kind[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", KINDS[k].dot)} />{KINDS[k].label}</span>)}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const list = on(d);
              const closed = d.getDay() === 0 || list.some((e) => e.closed);
              return (
                <div key={iso(d)} className={cn("min-h-24 border-r border-b p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0", !isSameMonth(d, month) && "bg-muted/20 text-muted-foreground", closed && isSameMonth(d, month) && "bg-destructive/[0.03]")}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", isToday(d) && "bg-primary font-semibold text-primary-foreground")}>{format(d, "d")}</span>
                    {manage && isSameMonth(d, month) && (
                      <button type="button" onClick={() => setAddingOn(iso(d))} className="rounded px-1 text-xs text-muted-foreground opacity-0 hover:bg-muted hover:opacity-100 focus-visible:opacity-100" aria-label={`Add on ${format(d, "d MMMM")}`}>+</button>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <li key={e.id}>
                        <button type="button" onClick={() => manage && setEditing(e)} disabled={!manage}
                          className={cn("block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium", KINDS[e.kind].chip)} title={e.title}>
                          {e.title}
                        </button>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} more</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        <aside aria-label="This month" className="space-y-2">
          <h2 className="font-semibold">This month</h2>
          {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing planned.</p> : upcoming.map((e) => (
            <div key={e.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KINDS[e.kind].dot)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(e.start_date), "EEE d MMM")}{e.end_date !== e.start_date && ` – ${format(parseISO(e.end_date), "EEE d MMM")}`} · {KINDS[e.kind].label}
                  </p>
                  {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
                </div>
                {manage && (
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${e.title}`} onClick={() => setEditing(e)}><Pencil aria-hidden /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${e.title}`} onClick={() => setRemoving(e)}><Trash2 aria-hidden /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </aside>
      </div>
      {manage && <EventDialog event={editing} day={addingOn ?? iso(new Date())} open={Boolean(editing) || Boolean(addingOn)} onOpenChange={(o) => { if (!o) { setEditing(null); setAddingOn(null); } }} />}
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Remove “${removing?.title}”?`} description={removing?.closed ? "Attendance opens again on those days." : "It disappears from everyone's calendar."}
        confirmLabel="Remove" onConfirm={() => removing && remove.mutate(removing.id)} />
    </>
  );
}
