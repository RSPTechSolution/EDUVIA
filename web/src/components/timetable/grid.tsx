"use client";

import { AlertTriangle, Ban, Coffee, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Period, TimetableEntry, TimetableView } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Subject colours, listed in full so Tailwind generates them. */
export const SUBJECT_COLORS: Record<string, { cell: string; dot: string }> = {
  blue: { cell: "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200", dot: "bg-blue-500" },
  green: { cell: "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200", dot: "bg-emerald-500" },
  amber: { cell: "bg-amber-500/12 border-amber-500/35 text-amber-900 dark:text-amber-200", dot: "bg-amber-500" },
  rose: { cell: "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200", dot: "bg-rose-500" },
  violet: { cell: "bg-violet-500/10 border-violet-500/30 text-violet-800 dark:text-violet-200", dot: "bg-violet-500" },
  teal: { cell: "bg-teal-500/10 border-teal-500/30 text-teal-800 dark:text-teal-200", dot: "bg-teal-500" },
  orange: { cell: "bg-orange-500/10 border-orange-500/30 text-orange-800 dark:text-orange-200", dot: "bg-orange-500" },
  sky: { cell: "bg-sky-500/10 border-sky-500/30 text-sky-800 dark:text-sky-200", dot: "bg-sky-500" },
  lime: { cell: "bg-lime-500/12 border-lime-600/35 text-lime-900 dark:text-lime-200", dot: "bg-lime-500" },
  pink: { cell: "bg-pink-500/10 border-pink-500/30 text-pink-800 dark:text-pink-200", dot: "bg-pink-500" },
  slate: { cell: "bg-slate-500/10 border-slate-500/30 text-slate-800 dark:text-slate-200", dot: "bg-slate-500" },
  indigo: { cell: "bg-indigo-500/10 border-indigo-500/30 text-indigo-800 dark:text-indigo-200", dot: "bg-indigo-500" },
};
export const COLOR_NAMES = Object.keys(SUBJECT_COLORS);
export const colorOf = (c: string) => SUBJECT_COLORS[c] ?? SUBJECT_COLORS.slate;

/** "13:25:00" -> "1:25 pm" */
export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** Today's weekday (1-6) and the period running now, refreshed every minute. Sunday is 0. */
export function useNow(periods: Period[]) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { day: 0, periodId: null as string | null };
  const m = now.getHours() * 60 + now.getMinutes();
  const current = periods.find((p) => minutes(p.start_time) <= m && m < minutes(p.end_time));
  return { day: now.getDay(), periodId: current?.id ?? null };
}

export const slotKey = (day: number, periodId: string) => `${day}:${periodId}`;

export function TimetableGrid({
  view, editable, onCellClick, blocked, highlightToday = true, emptyLabel = "Free",
}: {
  view: TimetableView;
  editable?: boolean;
  onCellClick?: (day: number, period: Period, entry: TimetableEntry | undefined) => void;
  /** Slots shown as unavailable (teacher availability). */
  blocked?: Set<string>;
  highlightToday?: boolean;
  emptyLabel?: string;
}) {
  const byslot = new Map(view.entries.map((e) => [slotKey(e.day, e.period_id), e]));
  const now = useNow(view.periods);
  const today = highlightToday ? now.day : 0;
  const teacherView = view.kind === "teacher";

  if (!view.periods.length) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No bell schedule yet. Set up periods first.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Weekly timetable for {view.title}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-28 border-b bg-card px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Period</th>
            {DAYS.map((d, i) => (
              <th key={d} scope="col" className={cn("border-b px-2 py-2.5 text-center text-xs font-semibold", today === i + 1 ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5", today === i + 1 && "bg-primary/10")}>
                  {d}{today === i + 1 && <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-label="Today" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.periods.map((p) => p.is_break ? (
            <tr key={p.id}>
              <th scope="row" className="sticky left-0 z-10 border-b bg-muted/40 px-3 py-1.5 text-left font-normal">
                <span className="block text-xs font-medium text-muted-foreground">{p.name}</span>
              </th>
              <td colSpan={6} className="border-b bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--muted)_8px,var(--muted)_9px)] px-3 py-1.5 text-center text-xs text-muted-foreground">
                <Coffee className="mr-1.5 inline size-3.5" aria-hidden />{p.name} · {formatTime(p.start_time)} – {formatTime(p.end_time)}
              </td>
            </tr>
          ) : (
            <tr key={p.id}>
              <th scope="row" className={cn("sticky left-0 z-10 border-b bg-card px-3 py-2 text-left align-top font-normal", now.periodId === p.id && "bg-primary/[0.06]")}>
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="block text-[11px] text-muted-foreground tabular">{formatTime(p.start_time)} – {formatTime(p.end_time)}</span>
              </th>
              {DAYS.map((_, i) => {
                const day = i + 1;
                const e = byslot.get(slotKey(day, p.id));
                const isBlocked = blocked?.has(slotKey(day, p.id));
                const live = today === day && now.periodId === p.id;
                const label = e
                  ? `${DAY_NAMES[i]}, ${p.name}: ${e.subject_name}${teacherView ? `, ${e.section_label}` : e.teacher_name ? ` with ${e.teacher_name}` : ", no teacher"}`
                  : `${DAY_NAMES[i]}, ${p.name}: ${isBlocked ? "unavailable" : "free"}`;
                const content = e ? (
                  <div className={cn("enter-fade relative flex h-full min-h-14 flex-col rounded-lg border px-2.5 py-1.5 text-left", colorOf(e.subject_color).cell, live && "ring-2 ring-primary ring-offset-1 ring-offset-card")}>
                    <span className="truncate text-[13px] leading-tight font-semibold">{e.subject_name}</span>
                    <span className="mt-0.5 truncate text-[11px] opacity-80">
                      {teacherView ? e.section_label : e.teacher_name ?? (
                        <span className="inline-flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="size-3" aria-hidden />No teacher</span>
                      )}
                    </span>
                    {e.room && <span className="truncate text-[10px] opacity-60">{e.room}</span>}
                    {live && <span className="absolute top-1 right-1.5 text-[9px] font-bold tracking-wide text-primary uppercase">Now</span>}
                  </div>
                ) : isBlocked ? (
                  <div className="flex h-full min-h-14 items-center justify-center rounded-lg border border-dashed bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--muted)_5px,var(--muted)_7px)] text-[11px] text-muted-foreground">
                    <Ban className="mr-1 size-3" aria-hidden />Unavailable
                  </div>
                ) : (
                  <div className={cn("flex h-full min-h-14 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground/70", editable && "group-hover:border-primary/50 group-hover:bg-primary/5 group-hover:text-primary")}>
                    {editable ? <><Plus className="mr-0.5 size-3.5" aria-hidden />Add</> : emptyLabel}
                  </div>
                );
                return (
                  <td key={day} className={cn("border-b p-1 align-top", today === day && "bg-primary/[0.03]")}>
                    {onCellClick ? (
                      <button type="button" aria-label={label} onClick={() => onCellClick(day, p, e)}
                        className="group block h-full w-full rounded-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]">
                        {content}
                      </button>
                    ) : <div aria-label={label}>{content}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Today's lessons as a vertical timeline, for dashboards. */
export function TodayList({ view, day }: { view: TimetableView; day: number }) {
  const now = useNow(view.periods);
  const lessons = view.periods
    .filter((p) => !p.is_break)
    .map((p) => ({ p, e: view.entries.find((e) => e.day === day && e.period_id === p.id) }))
    .filter((x) => x.e);
  if (!lessons.length) return <p className="py-4 text-sm text-muted-foreground">{day === 0 ? "It's Sunday. No classes today." : "No lessons scheduled today."}</p>;
  return (
    <ol className="relative space-y-2 before:absolute before:top-3 before:bottom-3 before:left-[5px] before:w-px before:bg-border">
      {lessons.map(({ p, e }) => {
        const live = now.day === day && now.periodId === p.id;
        return (
          <li key={p.id} className="relative flex items-center gap-3 pl-6">
            <span className={cn("absolute left-0 size-[11px] rounded-full ring-4 ring-card", live ? "bg-primary motion-safe:animate-pulse" : colorOf(e!.subject_color).dot)} aria-hidden />
            <span className="w-16 shrink-0 text-xs text-muted-foreground tabular">{formatTime(p.start_time)}</span>
            <span className={cn("min-w-0 flex-1 rounded-lg border px-3 py-2", colorOf(e!.subject_color).cell, live && "ring-2 ring-primary")}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{e!.subject_name}</span>
                {live && <span className="text-[10px] font-bold text-primary uppercase">Now</span>}
              </span>
              <span className="block truncate text-xs opacity-80">
                {view.kind === "teacher" ? e!.section_label : e!.teacher_name ?? "Teacher to be assigned"}{e!.room ? ` · ${e!.room}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
