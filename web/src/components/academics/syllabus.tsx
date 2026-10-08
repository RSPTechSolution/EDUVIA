"use client";

import type { CoverageRow } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Topics finished out of the syllabus, as a labelled progress bar. */
export function CoverageBar({ row }: { row: CoverageRow }) {
  const pct = row.percent ?? 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{row.done} of {row.total} topics</span>
        <span className="font-semibold text-foreground tabular">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
           aria-label={`${row.subject_name} syllabus covered`}>
        <div className={cn("h-full rounded-full transition-all", pct >= 75 ? "bg-success" : pct >= 40 ? "bg-primary" : "bg-warning")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
