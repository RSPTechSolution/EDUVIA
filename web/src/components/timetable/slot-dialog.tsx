"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, Check, Trash2, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import type { AvailableTeacher, Period, Subject, TimetableEntry } from "@/lib/api/types";
import { initials } from "@/lib/format";
import { useAvailableTeachers } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { DAY_NAMES, colorOf, formatTime } from "./grid";

export interface SlotTarget {
  sectionId: string;
  sectionLabel: string;
  day: number;
  period: Period;
  entry?: TimetableEntry;
}

function TeacherOption({ t, selected, onSelect }: { t: AvailableTeacher; selected: boolean; onSelect: () => void }) {
  const disabled = t.status === "busy" || t.status === "unavailable";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:bg-muted disabled:cursor-not-allowed",
        selected ? "bg-primary/10" : "enabled:hover:bg-muted/60",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
        {initials(t.full_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium", disabled && "text-muted-foreground")}>{t.full_name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {t.status === "busy" ? `Teaching ${t.busy_with}` : t.status === "unavailable" ? "Marked unavailable" : `${t.periods_that_day} today · ${t.periods_per_week} this week`}
        </span>
      </span>
      {t.status === "free" && (t.qualified
        ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Free</span>
        : <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">Free · other subject</span>)}
      {t.status === "current" && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Current</span>}
      {t.status === "busy" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Busy</span>}
      {t.status === "unavailable" && <Ban className="size-4 text-muted-foreground" aria-hidden />}
      {selected && <Check className="size-4 text-primary" aria-hidden />}
    </button>
  );
}

export function SlotDialog({ target, subjects, onClose }: { target: SlotTarget | null; subjects: Subject[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!target) return;
    setSubjectId(target.entry?.subject_id ?? "");
    setTeacherId(target.entry?.teacher_id ?? null);
    setRoom(target.entry?.room ?? "");
    setShowAll(false);
  }, [target]);

  const available = useAvailableTeachers(target ? {
    day: target.day, period_id: target.period.id, section_id: target.sectionId, ...(subjectId ? { subject_id: subjectId } : {}),
  } : null);
  const list = (available.data ?? []).filter((t) => showAll || t.qualified || t.status === "current" || t.id === teacherId);
  const freeQualified = (available.data ?? []).filter((t) => t.status === "free" && t.qualified).length;

  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: ["timetable"] });
    toast.success(msg);
    onClose();
  };
  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Could not save the slot");
  const save = useMutation({
    mutationFn: () => api("/timetable/slots", {
      method: "PUT",
      body: { section_id: target!.sectionId, day: target!.day, period_id: target!.period.id, subject_id: subjectId, teacher_id: teacherId, room: room || null },
    }),
    onSuccess: () => done("Timetable updated"),
    onError,
  });
  const clear = useMutation({
    mutationFn: () => api("/timetable/slots", { method: "DELETE", query: { section_id: target!.sectionId, day: target!.day, period_id: target!.period.id } }),
    onSuccess: () => done("Slot cleared"),
    onError,
  });
  const subject = subjects.find((s) => s.id === subjectId);

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.sectionLabel} · {target ? DAY_NAMES[target.day - 1] : ""}</DialogTitle>
          <DialogDescription>{target?.period.name}, {target && formatTime(target.period.start_time)} – {target && formatTime(target.period.end_time)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Subject" required>
            {(a) => (
              <Select value={subjectId || undefined} onValueChange={(v) => setSubjectId(String(v))}>
                <SelectTrigger id={a.id} className="w-full">
                  <SelectValue placeholder="Choose a subject">
                    {subject && <span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", colorOf(subject.color).dot)} />{subject.name}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}><span className={cn("size-2.5 rounded-full", colorOf(s.color).dot)} />{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Room">{(a) => <Input {...a} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 204" maxLength={30} />}</Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Teacher</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showAll} onCheckedChange={setShowAll} aria-label="Show teachers of other subjects" />Other subjects
            </label>
          </div>
          {subjectId && !available.isLoading && freeQualified === 0 && (
            <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />No {subject?.name} teacher is free now. Turn on &quot;Other subjects&quot; to pick someone else.
            </p>
          )}
          <div role="radiogroup" aria-label="Teacher" className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            <button type="button" role="radio" aria-checked={teacherId === null} onClick={() => setTeacherId(null)}
              className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm outline-none focus-visible:bg-muted", teacherId === null ? "bg-primary/10" : "hover:bg-muted/60")}>
              <span className="flex size-8 items-center justify-center rounded-full bg-muted"><UserX className="size-4 text-muted-foreground" aria-hidden /></span>
              <span className="flex-1 text-muted-foreground">No teacher yet</span>
              {teacherId === null && <Check className="size-4 text-primary" aria-hidden />}
            </button>
            {available.isLoading ? <p className="px-3 py-3 text-sm text-muted-foreground">Checking who&apos;s free…</p>
              : list.map((t) => <TeacherOption key={t.id} t={t} selected={teacherId === t.id} onSelect={() => setTeacherId(t.id)} />)}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {target?.entry ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => clear.mutate()} loading={clear.isPending} loadingText="Clearing…">
              <Trash2 aria-hidden />Clear slot
            </Button>
          ) : <span />}
          <Button onClick={() => save.mutate()} disabled={!subjectId} loading={save.isPending} loadingText="Saving…">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
