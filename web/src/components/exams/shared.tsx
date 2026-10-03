import { cn } from "@/lib/utils";
import type { ExamStatus } from "@/lib/api/types";

export const EXAM_STATUS: Record<ExamStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  upcoming: { label: "Upcoming", cls: "bg-info/12 text-info" },
  ongoing: { label: "In progress", cls: "bg-primary/12 text-primary" },
  marks_entry: { label: "Marks entry", cls: "bg-warning/12 text-warning" },
  published: { label: "Results out", cls: "bg-success/12 text-success" },
};

export const KIND: Record<string, string> = { unit_test: "Unit test", term: "Term exam", final: "Final exam" };

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const s = EXAM_STATUS[status];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>{s.label}</span>;
}

/** CBSE grades with a tone; the letter always carries the meaning. */
export function GradeBadge({ grade, className }: { grade: string | null; className?: string }) {
  if (!grade) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const tone = grade.startsWith("A") ? "bg-success/12 text-success" : grade.startsWith("B") ? "bg-primary/10 text-primary"
    : grade.startsWith("C") ? "bg-info/12 text-info" : grade === "D" ? "bg-warning/12 text-warning" : "bg-destructive/10 text-destructive";
  return <span className={cn("inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular", tone, className)}>{grade}</span>;
}

export const fmtMarks = (v: number | null) => (v === null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));

export function gradeFor(percent: number | null) {
  if (percent === null) return null;
  for (const [floor, g] of [[91, "A1"], [81, "A2"], [71, "B1"], [61, "B2"], [51, "C1"], [41, "C2"], [33, "D"]] as const) if (percent >= floor) return g;
  return "E";
}
