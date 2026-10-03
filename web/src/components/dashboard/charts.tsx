"use client";

import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { roleLabel } from "@/lib/format";

const tooltipClass = "rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md";

/** Daily sign-ins. Colours come from CSS classes so both themes work. */
export function SigninsChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div
      className="h-64 w-full text-primary [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border"
      role="img" aria-label={`Sign-ins over the last ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="signinFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="[stop-color:var(--primary)] [stop-opacity:0.28]" />
              <stop offset="100%" className="[stop-color:var(--primary)] [stop-opacity:0]" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => format(parseISO(d), "d MMM")}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className={tooltipClass}>
                  <p className="font-medium">{format(parseISO(payload[0].payload.date), "EEEE, d MMM")}</p>
                  <p className="text-muted-foreground"><span className="font-semibold text-foreground">{payload[0].value}</span> sign-ins</p>
                </div>
              ) : null
            }
          />
          <Area type="monotone" dataKey="count" stroke="currentColor" strokeWidth={2.5} fill="url(#signinFill)" activeDot={{ r: 5, strokeWidth: 0, fill: "currentColor" }} />
        </AreaChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Sign-ins per day</caption>
        <tbody>{data.map((d) => <tr key={d.date}><th scope="row">{d.date}</th><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

const SLICE = ["fill-chart-1", "fill-chart-2", "fill-chart-3", "fill-chart-4", "fill-chart-5", "fill-chart-6"];
const DOT = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

/** People by role: top five roles, the rest grouped. */
export function RolesDonut({ data }: { data: { role: string; count: number }[] }) {
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((n, r) => n + r.count, 0);
  const slices = [...top.map((r) => ({ name: roleLabel(r.role), value: r.count })), ...(rest ? [{ name: "Other", value: rest }] : [])];
  const total = slices.reduce((n, s) => n + s.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative size-44 shrink-0" role="img" aria-label={`${total} people by role`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none" isAnimationActive>
              {slices.map((s, i) => <Cell key={s.name} className={SLICE[i % SLICE.length]} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? <div className={tooltipClass}><span className="font-semibold">{payload[0].value}</span> {payload[0].name}</div> : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
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
