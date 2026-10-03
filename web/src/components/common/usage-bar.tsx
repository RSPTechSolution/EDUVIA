import { cn } from "@/lib/utils";

/** "120 of 300 students" with a bar that turns amber at 80% and red at 100%. */
export function UsageBar({ label, used, limit, className }: { label: string; used: number; limit: number | null; className?: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = !limit ? "bg-primary" : pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular">
          <span className="font-semibold text-foreground">{used.toLocaleString("en-IN")}</span>
          {limit === null ? " · unlimited" : ` of ${limit.toLocaleString("en-IN")}`}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${label} used`}
        aria-valuemin={0}
        aria-valuemax={limit ?? used}
        aria-valuenow={used}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${limit ? pct : 8}%` }} />
      </div>
    </div>
  );
}
