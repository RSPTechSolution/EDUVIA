"use client";

import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, parseISO, startOfMonth } from "date-fns";
import { CalendarOff, Check, ChevronLeft, ChevronRight, Clock, Minus, X } from "lucide-react";
import type { AttendanceCounts, AttendanceStatus, StudentAttendance } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Status colours are reserved for these states and always shown with a label or icon. */
export const STATUS: Record<AttendanceStatus, { label: string; short: string; icon: React.ElementType; chip: string; solid: string; dot: string }> = {
  present: { label: "Present", short: "P", icon: Check, chip: "bg-success/12 text-success border-success/30", solid: "bg-success text-white border-success", dot: "bg-success" },
  absent: { label: "Absent", short: "A", icon: X, chip: "bg-destructive/10 text-destructive border-destructive/30", solid: "bg-destructive text-white border-destructive", dot: "bg-destructive" },
  late: { label: "Late", short: "L", icon: Clock, chip: "bg-warning/12 text-warning border-warning/35", solid: "bg-warning text-white border-warning", dot: "bg-warning" },
  half_day: { label: "Half day", short: "½", icon: Minus, chip: "bg-info/12 text-info border-info/30", solid: "bg-info text-white border-info", dot: "bg-info" },
  leave: { label: "Leave", short: "Lv", icon: CalendarOff, chip: "bg-muted text-muted-foreground border-border", solid: "bg-muted-foreground text-white border-muted-foreground", dot: "bg-muted-foreground" },
};
export const STATUS_ORDER: AttendanceStatus[] = ["present", "absent", "late", "half_day", "leave"];

export function StatusPicker({ value, onChange, disabled, name }: { value: AttendanceStatus | null; onChange: (s: AttendanceStatus) => void; disabled?: boolean; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Attendance for ${name}`} className="inline-flex gap-1">
      {STATUS_ORDER.map((s) => {
        const m = STATUS[s];
        const on = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            title={m.label}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90 disabled:cursor-not-allowed disabled:opacity-60",
              on ? cn(m.solid, "shadow-sm") : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {m.short}
          </button>
        );
      })}
    </div>
  );
}

export function StatusChip({ status }: { status: AttendanceStatus }) {
  const m = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", m.chip)}>
      <m.icon className="size-3" aria-hidden />{m.label}
    </span>
  );
}

/** Percentage with a plain-language threshold, never colour alone. */
export function PercentBadge({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  const low = value < 75;
  const watch = value < 85;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular",
      low ? "bg-destructive/10 text-destructive" : watch ? "bg-warning/12 text-warning" : "bg-success/12 text-success", className)}
      title={low ? "Below 75%" : watch ? "Below 85%" : "Good"}>
      {value}%{low && <span className="font-normal">· low</span>}
    </span>
  );
}

export function CountsLine({ counts }: { counts: AttendanceCounts }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", STATUS[s].dot)} aria-hidden />
          <span className="text-muted-foreground">{STATUS[s].label}</span>
          <span className="font-semibold tabular">{counts[s]}</span>
        </li>
      ))}
    </ul>
  );
}

/** A month of attendance as a calendar. Sundays and unmarked days are blank. */
export function MonthCalendar({ data, month, onMonthChange, maxMonth }: {
  data: StudentAttendance | undefined;
  month: string;
  onMonthChange: (m: string) => void;
  maxMonth: string;
}) {
  const start = startOfMonth(parseISO(`${month}-01`));
  const days = eachDayOfInterval({ start, end: endOfMonth(start) });
  const byDay = new Map(data?.days.map((d) => [d.date, d]));
  const lead = (getDay(start) + 6) % 7; // Monday first
  const today = new Date();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => onMonthChange(format(addMonths(start, -1), "yyyy-MM"))}
          className="rounded-lg p-1.5 hover:bg-muted"><ChevronLeft className="size-5" /></button>
        <p className="font-heading font-bold">{format(start, "MMMM yyyy")}</p>
        <button type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => onMonthChange(format(addMonths(start, 1), "yyyy-MM"))}
          className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-30"><ChevronRight className="size-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <li key={`x${i}`} aria-hidden />)}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const rec = byDay.get(key);
          const m = rec ? STATUS[rec.status] : null;
          return (
            <li key={key} title={rec ? `${format(d, "d MMM")}: ${m!.label}${rec.remark ? ` (${rec.remark})` : ""}` : format(d, "d MMM")}
              aria-label={`${format(d, "EEEE d MMMM")}: ${m ? m.label : getDay(d) === 0 ? "Sunday" : "not marked"}`}
              className={cn("flex aspect-square flex-col items-center justify-center rounded-lg border text-sm tabular transition-transform hover:scale-105",
                m ? m.chip : getDay(d) === 0 ? "border-transparent text-muted-foreground/50" : "border-dashed text-muted-foreground",
                isSameDay(d, today) && "ring-2 ring-primary")}>
              <span className="font-semibold leading-none">{format(d, "d")}</span>
              {m && <m.icon className="mt-0.5 size-3" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
