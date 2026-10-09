"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addHours, format, isToday, parseISO, startOfHour } from "date-fns";
import { Ban, ExternalLink, Plus, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useCan } from "@/components/session-provider";
import { colorOf } from "@/components/timetable/grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { LiveClass } from "@/lib/api/types";
import { useHomeworkTargets, useLiveClasses } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const targets = useHomeworkTargets(open);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [start, setStart] = useState(format(addHours(startOfHour(new Date()), 1), "yyyy-MM-dd'T'HH:mm"));
  const [duration, setDuration] = useState("40");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setTitle(""); setSections([]); setUrl(""); setNotes(""); setError(null); } }, [open]);
  const save = useMutation({
    mutationFn: () => {
      const subject = targets.data?.find((t) => sections.includes(t.section_id))?.subjects;
      return api("/live-classes", { method: "POST", body: { title, section_ids: sections, starts_at: new Date(start).toISOString(), duration_minutes: Number(duration),
        meeting_url: url.trim() || null, notes: notes || null, subject_id: subject?.length === 1 ? subject[0].id : null } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["live-classes"] }); toast.success("Live class scheduled. Families have been told."); onOpenChange(false); },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not schedule"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Schedule a live class</DialogTitle><DialogDescription>Paste a Google Meet or Zoom link, or leave it empty for a free Jitsi room.</DialogDescription></DialogHeader>
        <form id="live-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Title" required className="sm:col-span-2">{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Fractions revision" />}</Field>
          <Field label="Starts">{(a) => <Input {...a} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Minutes">{(a) => <Input {...a} type="number" min={10} max={240} value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Classes</legend>
            <div className="flex max-h-32 flex-wrap gap-3 overflow-y-auto">{targets.data?.map((t) => (
              <label key={t.section_id} className="flex items-center gap-2 text-sm"><Checkbox checked={sections.includes(t.section_id)} onCheckedChange={(c) => setSections((x) => (c ? [...x, t.section_id] : x.filter((y) => y !== t.section_id)))} />{t.section_label}</label>
            ))}</div>
          </fieldset>
          <Field label="Meeting link" className="sm:col-span-2" hint="Must start with https://">{(a) => <Input {...a} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/…" />}</Field>
          <Field label="Notes" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Keep your notebook and textbook ready" />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="live-form" disabled={!title.trim() || !sections.length} loading={save.isPending}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LiveCard({ l }: { l: LiveClass }) {
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => api(`/live-classes/${l.id}/cancel`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["live-classes"] }); toast.success("Cancelled. Families have been told."); },
  });
  const start = parseISO(l.starts_at);
  return (
    <li className={cn("rounded-xl border bg-card p-4", l.state === "live" && "border-success/60 ring-2 ring-success/20", l.state === "cancelled" && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        {l.subject_name && <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", colorOf(l.subject_color ?? "slate").cell)}>{l.subject_name}</span>}
        <span className="text-sm text-muted-foreground">{l.sections_label}</span>
        {l.state === "live" && <span className="ml-auto rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-white">Live now</span>}
        {l.state === "cancelled" && <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Cancelled</span>}
      </div>
      <p className="mt-1.5 font-semibold">{l.title}</p>
      <p className="text-sm text-muted-foreground">{isToday(start) ? "Today" : format(start, "EEE d MMM")}, {format(start, "h:mm a")} · {l.duration_minutes} min · {l.provider}{l.teacher ? ` · ${l.teacher}` : ""}</p>
      {l.notes && <p className="mt-1 text-sm">{l.notes}</p>}
      <div className="mt-3 flex gap-2">
        {(l.state === "live" || l.state === "upcoming") && (
          <Button size="sm" variant={l.state === "live" ? "default" : "outline"} render={<a href={l.meeting_url} target="_blank" rel="noreferrer" />}><ExternalLink aria-hidden />Join</Button>
        )}
        {l.can_edit && l.state === "upcoming" && <Button size="sm" variant="ghost" onClick={() => cancel.mutate()} loading={cancel.isPending}><Ban aria-hidden />Cancel</Button>}
      </div>
    </li>
  );
}

export default function LiveClassesPage() {
  const can = useCan();
  const q = useLiveClasses();
  const [scheduling, setScheduling] = useState(false);
  const now = (q.data ?? []).filter((l) => l.state === "live" || l.state === "upcoming");
  const past = (q.data ?? []).filter((l) => l.state === "ended" || l.state === "cancelled");
  return (
    <>
      <PageHeader title="Live classes" description="Online lessons with a meeting link. The Join button works on phones and computers."
        actions={can("live.manage") && <Button onClick={() => setScheduling(true)}><Plus aria-hidden />Schedule</Button>} />
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Video className="size-12 text-muted-foreground/60" aria-hidden />} title="No live classes" />
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">{now.map((l) => <LiveCard key={l.id} l={l} />)}</ul>
          {past.length > 0 && <><h2 className="mt-8 mb-3 font-heading text-lg font-bold">Earlier</h2><ul className="grid gap-3 lg:grid-cols-2">{past.map((l) => <LiveCard key={l.id} l={l} />)}</ul></>}
        </>
      )}
      {can("live.manage") && <ScheduleDialog open={scheduling} onOpenChange={setScheduling} />}
    </>
  );
}
