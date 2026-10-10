"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Horizontal bars as plain HTML: label, bar, value. One hue; the label carries identity. */
export function BarList({ items, format: fmt = (v) => v.toLocaleString("en-IN") }: {
  items: { label: string; value: number; hint?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.label}{i.hint && <span className="ml-1.5 text-xs text-muted-foreground">{i.hint}</span>}</span>
            <span className="font-semibold tabular">{fmt(i.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width] duration-700 group-hover:bg-primary/80" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Placeholder rows shaped like a BarList (label line, then bar), for while its data loads. */
export function BarListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <div className="mb-1 flex h-5 items-center justify-between gap-3">
            <Skeleton className="h-3.5" style={{ width: `${55 - i * 8}%` }} />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <Skeleton className="h-2 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
