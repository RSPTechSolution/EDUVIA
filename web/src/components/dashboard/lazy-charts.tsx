"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel } from "@/lib/format";

// The charts, loaded after the page so the chart library isn't in its first JavaScript. Each placeholder is exactly
// the size of its chart, so nothing moves when the chart draws.
const box = (height: string) => function ChartPlaceholder() {
  return <Skeleton className={`${height} w-full`} />;
};

export const SigninsChart = dynamic(() => import("./charts").then((m) => m.SigninsChart), { ssr: false, loading: box("h-64") });
export const AttendanceTrendChart = dynamic(() => import("./charts").then((m) => m.AttendanceTrendChart), { ssr: false, loading: box("h-56") });
export const CollectionChart = dynamic(() => import("./charts").then((m) => m.CollectionChart), { ssr: false, loading: box("h-60") });
export const IncomeExpenseChart = dynamic(() => import("./charts").then((m) => m.IncomeExpenseChart), { ssr: false, loading: box("h-64") });
export const MonthlyCollectionChart = dynamic(() => import("./charts").then((m) => m.MonthlyCollectionChart), { ssr: false, loading: box("h-60") });

const RolesPie = dynamic(() => import("./charts").then((m) => m.RolesPie), { ssr: false, loading: () => <Skeleton className="size-full rounded-full" /> });

const DOT = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

/** People by role: top five roles, the rest grouped. The total and legend draw straight away; the pie follows. */
export function RolesDonut({ data }: { data: { role: string; count: number }[] }) {
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((n, r) => n + r.count, 0);
  const slices = [...top.map((r) => ({ name: roleLabel(r.role), value: r.count })), ...(rest ? [{ name: "Other", value: rest }] : [])];
  const total = slices.reduce((n, s) => n + s.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative size-44 shrink-0" role="img" aria-label={`${total} people by role`}>
        <RolesPie slices={slices} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-3xl font-extrabold tabular">{total}</span>
          <span className="text-xs text-muted-foreground">people</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5">
            <span className={`size-2.5 rounded-full ${DOT[i % DOT.length]}`} aria-hidden />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="font-semibold tabular">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** RolesDonut's shape while its numbers load: the ring and a legend of typical length. */
export function RolesDonutSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row" aria-busy="true">
      <Skeleton className="size-44 shrink-0 rounded-full" />
      <ul className="w-full space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex h-5 items-center gap-2.5"><Skeleton className="size-2.5 rounded-full" /><Skeleton className="h-3.5 flex-1" /><Skeleton className="h-3.5 w-8" /></li>
        ))}
      </ul>
    </div>
  );
}
