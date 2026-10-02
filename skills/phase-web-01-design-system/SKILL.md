---
name: schoolerp-web-phase-01-design-system
description: >
  Web Phase 1 of SchoolERP — establishes the complete design system for the
  Next.js 15 web dashboard. Covers design tokens, typography scale, color palette
  (light + dark), shadcn/ui customization, Tailwind v4 config, reusable component
  library, animation standards, accessibility (WCAG 2.1 AA), and Storybook setup.
  Use when building or updating any visual component, theme, or design token.
---

# Web Phase 1 — Design System
## Next.js 15 · shadcn/ui · Tailwind v4 · Framer Motion · Storybook

---

## Design Philosophy

SchoolERP's web dashboard must feel **professional, modern, and trustworthy** —
the kind of dashboard a school principal would proudly show parents. It should:

- Load fast and feel snappy (skeleton loaders, optimistic updates)
- Work flawlessly on 13" laptops and 27" monitors
- Be fully navigable by keyboard (principals use Tab a lot)
- Look equally polished in light and dark mode
- Surface data at a glance — no hunting for numbers
- Use motion purposefully — never decorative for its own sake

---

## Color Palette

```css
/* web/src/app/globals.css */
@layer base {
  :root {
    /* Brand */
    --brand-50:  #EEF5FF;
    --brand-100: #D9E8FF;
    --brand-200: #B3D1FF;
    --brand-300: #7DB4FF;
    --brand-400: #4090FF;
    --brand-500: #1A6FE8;   /* Primary action */
    --brand-600: #1558C0;   /* Hover state */
    --brand-700: #1244A0;   /* Active/pressed */
    --brand-800: #0F3480;
    --brand-900: #0A2560;
    --brand-950: #061840;   /* Sidebar bg */

    /* Semantic — Light Mode */
    --background:        0 0% 98%;          /* #FAFAFA — page bg */
    --foreground:        222 20% 10%;       /* #141820 — primary text */
    --card:              0 0% 100%;         /* #FFFFFF — card bg */
    --card-foreground:   222 20% 10%;
    --popover:           0 0% 100%;
    --popover-foreground:222 20% 10%;
    --primary:           218 85% 50%;       /* #1A6FE8 */
    --primary-foreground:0 0% 100%;
    --secondary:         220 14% 95%;       /* #F0F2F5 */
    --secondary-foreground:222 20% 25%;
    --muted:             220 14% 95%;
    --muted-foreground:  220 10% 48%;       /* #718096 */
    --accent:            218 85% 96%;       /* #EEF5FF — light brand tint */
    --accent-foreground: 218 85% 35%;
    --destructive:       0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border:            220 13% 91%;       /* #E2E8F0 */
    --input:             220 13% 91%;
    --ring:              218 85% 50%;

    /* Sidebar */
    --sidebar:           222 47% 11%;       /* #0F2028 — deep navy */
    --sidebar-foreground:210 40% 90%;
    --sidebar-border:    222 40% 16%;
    --sidebar-accent:    218 85% 50%;
    --sidebar-accent-foreground: 0 0% 100%;
    --sidebar-muted:     220 20% 55%;

    /* Status Colors */
    --success:    142 71% 45%;   /* green */
    --warning:    38 92% 50%;    /* amber */
    --info:       199 89% 48%;   /* cyan */
    --error:      0 84% 60%;     /* red */

    /* Data Viz Palette */
    --chart-1: 218 85% 50%;   /* brand blue */
    --chart-2: 142 71% 45%;   /* green */
    --chart-3: 38 92% 50%;    /* amber */
    --chart-4: 271 76% 53%;   /* purple */
    --chart-5: 199 89% 48%;   /* cyan */
    --chart-6: 350 89% 60%;   /* rose */

    /* Radius */
    --radius:    0.625rem;   /* 10px — card corners */
    --radius-sm: 0.375rem;   /* 6px — badge, chip */
    --radius-lg: 1rem;       /* 16px — modal, sheet */
    --radius-xl: 1.5rem;     /* 24px — hero sections */

    /* Shadow */
    --shadow-xs: 0 1px 2px rgba(0,0,0,.05);
    --shadow-sm: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06);
    --shadow-md: 0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
    --shadow-lg: 0 10px 15px rgba(0,0,0,.08), 0 4px 6px rgba(0,0,0,.05);
    --shadow-xl: 0 20px 25px rgba(0,0,0,.09), 0 8px 10px rgba(0,0,0,.04);
    --shadow-card: var(--shadow-sm);
    --shadow-hover: var(--shadow-md);
  }

  .dark {
    --background:        222 20% 7%;        /* #0E1117 */
    --foreground:        210 40% 92%;       /* #E2EAF4 */
    --card:              222 20% 10%;       /* #141820 */
    --card-foreground:   210 40% 92%;
    --popover:           222 20% 10%;
    --popover-foreground:210 40% 92%;
    --primary:           218 85% 58%;       /* #3D8BFF — brighter in dark */
    --primary-foreground:0 0% 100%;
    --secondary:         222 20% 14%;       /* #1C2230 */
    --secondary-foreground:210 40% 75%;
    --muted:             222 20% 14%;
    --muted-foreground:  220 10% 55%;
    --accent:            218 85% 20%;
    --accent-foreground: 218 85% 75%;
    --destructive:       0 70% 55%;
    --destructive-foreground: 0 0% 100%;
    --border:            222 20% 16%;       /* #1E2736 */
    --input:             222 20% 16%;
    --ring:              218 85% 58%;

    --sidebar:           222 25% 6%;        /* #0A0E16 */
    --sidebar-foreground:210 30% 82%;
    --sidebar-border:    222 25% 11%;
    --sidebar-accent:    218 85% 58%;
    --sidebar-muted:     220 15% 45%;

    --shadow-xs: 0 1px 2px rgba(0,0,0,.3);
    --shadow-sm: 0 1px 3px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.3);
    --shadow-md: 0 4px 6px rgba(0,0,0,.4), 0 2px 4px rgba(0,0,0,.3);
    --shadow-lg: 0 10px 15px rgba(0,0,0,.45), 0 4px 6px rgba(0,0,0,.3);
  }
}
```

---

## Typography Scale

```typescript
// web/src/lib/fonts.ts
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

// Primary UI font — clean, modern, highly legible
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Headings and display text — more personality
export const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

// Code blocks, invoice numbers, IDs
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
```

```css
/* Typography scale in globals.css */
.text-display-2xl { font-size: 4.5rem;  line-height: 1.1;  font-weight: 800; }
.text-display-xl  { font-size: 3.75rem; line-height: 1.1;  font-weight: 700; }
.text-display-lg  { font-size: 3rem;    line-height: 1.2;  font-weight: 700; }
.text-display-md  { font-size: 2.25rem; line-height: 1.25; font-weight: 700; }
.text-display-sm  { font-size: 1.875rem;line-height: 1.3;  font-weight: 600; }
.text-xl  { font-size: 1.25rem; line-height: 1.5; }
.text-lg  { font-size: 1.125rem;line-height: 1.6; }
.text-md  { font-size: 1rem;    line-height: 1.6; }
.text-sm  { font-size: 0.875rem;line-height: 1.5; }
.text-xs  { font-size: 0.75rem; line-height: 1.4; }
```

---

## Tailwind v4 Config

```typescript
// web/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          950: 'var(--brand-950)',
        },
      },
      borderRadius: {
        sm:  'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg:  'var(--radius-lg)',
        xl:  'var(--radius-xl)',
      },
      boxShadow: {
        card:  'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        lg:    'var(--shadow-lg)',
        xl:    'var(--shadow-xl)',
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
        'count-up':    'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn:    { from:{ opacity:'0' },              to:{ opacity:'1' } },
        slideUp:   { from:{ transform:'translateY(8px)',opacity:'0' }, to:{ transform:'translateY(0)',opacity:'1' } },
        slideRight:{ from:{ transform:'translateX(-8px)',opacity:'0' }, to:{ transform:'translateX(0)',opacity:'1' } },
        pulseSoft: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'.6' } },
        countUp:   { from:{ transform:'translateY(100%)' }, to:{ transform:'translateY(0)' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;
```

---

## Core Component Library

### 1. StatCard — Dashboard KPI Card

```tsx
// web/src/components/ui/stat-card.tsx
'use client';
import { cn } from '@/lib/utils';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';
import { CountUp } from './count-up';

interface StatCardProps {
  title:       string;
  value:       number | string;
  prefix?:     string;   // e.g. "₹"
  suffix?:     string;   // e.g. "%"
  trend?:      number;   // % change vs last period
  trendLabel?: string;   // e.g. "vs last month"
  icon:        React.ElementType;
  iconColor?:  string;   // tailwind color class
  loading?:    boolean;
  onClick?:    () => void;
  className?:  string;
}

export function StatCard({
  title, value, prefix, suffix, trend, trendLabel = 'vs last period',
  icon: Icon, iconColor = 'text-primary', loading, onClick, className,
}: StatCardProps) {
  if (loading) return <StatCardSkeleton />;

  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;
  const TrendIcon = trendPositive ? ArrowUpIcon : trendNegative ? ArrowDownIcon : MinusIcon;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl bg-card border border-border',
        'p-6 shadow-card transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-hover hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      {/* Subtle gradient accent top-right */}
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-transparent" aria-hidden />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-xl font-semibold text-muted-foreground">{prefix}</span>}
            <span className="font-display text-display-sm font-bold text-foreground tabular-nums">
              {typeof value === 'number' ? <CountUp end={value} /> : value}
            </span>
            {suffix && <span className="text-xl font-semibold text-muted-foreground">{suffix}</span>}
          </div>
        </div>
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          'bg-primary/10 transition-colors group-hover:bg-primary/15',
        )}>
          <Icon className={cn('h-6 w-6', iconColor)} aria-hidden />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className={cn(
            'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
            trendPositive ? 'bg-success/10 text-success' :
            trendNegative ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground',
          )}>
            <TrendIcon className="h-3 w-3" aria-hidden />
            {Math.abs(trend)}%
          </span>
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="mt-4 h-4 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
```

### 2. DataTable — Full-Featured Table

```tsx
// web/src/components/data-table/data-table.tsx
'use client';
import {
  flexRender, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel,
  useReactTable, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns:     ColumnDef<TData, TValue>[];
  data:        TData[];
  searchable?: boolean;
  searchKey?:  string;
  searchPlaceholder?: string;
  loading?:    boolean;
  emptyMessage?: string;
  toolbar?:    React.ReactNode;   // action buttons top-right
  className?:  string;
}

export function DataTable<TData, TValue>({
  columns, data, searchable = true, searchKey, searchPlaceholder = 'Search...',
  loading, emptyMessage = 'No records found.', toolbar, className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data, columns,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: { sorting, globalFilter },
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm" role="grid">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border bg-muted/30">
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          'h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                          canSort && 'cursor-pointer select-none hover:text-foreground',
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span aria-hidden>
                              {sorted === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> :
                               sorted === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> :
                               <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {columns.map((_, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" style={{ width: `${60 + Math.random()*30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="h-48 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}
                    className="border-b border-border/50 transition-colors hover:bg-muted/30 data-[state=selected]:bg-accent/50"
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center gap-3 border-t border-border px-4 py-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of{' '}
            {table.getFilteredRowModel().rows.length} records
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">Previous</Button>
            <span className="text-xs text-muted-foreground">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3. PageHeader — Consistent Page Titles

```tsx
// web/src/components/layout/page-header.tsx
import { cn } from '@/lib/utils';
import { Breadcrumb } from './breadcrumb';

interface PageHeaderProps {
  title:       string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?:    React.ReactNode;
  className?:  string;
}

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-1', className)}>
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-display-sm font-bold text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
```

### 4. StatusBadge — Semantic Status Chips

```tsx
// web/src/components/ui/status-badge.tsx
import { cn } from '@/lib/utils';

type Status = 'active' | 'inactive' | 'pending' | 'paid' | 'unpaid' | 'partial' |
              'present' | 'absent' | 'late' | 'approved' | 'rejected' | 'draft' |
              'published' | 'overdue' | 'expiring' | 'expired' | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active:     { label: 'Active',     className: 'bg-success/10 text-success border-success/20' },
  inactive:   { label: 'Inactive',   className: 'bg-muted text-muted-foreground border-border' },
  pending:    { label: 'Pending',    className: 'bg-warning/10 text-warning border-warning/20' },
  paid:       { label: 'Paid',       className: 'bg-success/10 text-success border-success/20' },
  unpaid:     { label: 'Unpaid',     className: 'bg-destructive/10 text-destructive border-destructive/20' },
  partial:    { label: 'Partial',    className: 'bg-warning/10 text-warning border-warning/20' },
  present:    { label: 'Present',    className: 'bg-success/10 text-success border-success/20' },
  absent:     { label: 'Absent',     className: 'bg-destructive/10 text-destructive border-destructive/20' },
  late:       { label: 'Late',       className: 'bg-warning/10 text-warning border-warning/20' },
  approved:   { label: 'Approved',   className: 'bg-success/10 text-success border-success/20' },
  rejected:   { label: 'Rejected',   className: 'bg-destructive/10 text-destructive border-destructive/20' },
  draft:      { label: 'Draft',      className: 'bg-muted text-muted-foreground border-border' },
  published:  { label: 'Published',  className: 'bg-info/10 text-info border-info/20' },
  overdue:    { label: 'Overdue',    className: 'bg-destructive/10 text-destructive border-destructive/20' },
  expiring:   { label: 'Expiring',   className: 'bg-warning/10 text-warning border-warning/20' },
  expired:    { label: 'Expired',    className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
      config.className, className,
    )}>
      {config.label}
    </span>
  );
}
```

### 5. EmptyState — Illustrated Empty States

```tsx
// web/src/components/ui/empty-state.tsx
import { cn } from '@/lib/utils';
import { Button } from './button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon:       LucideIcon;
  title:      string;
  description:string;
  action?:    { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}
         role="status" aria-label={title}>
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### 6. CountUp — Animated Number

```tsx
// web/src/components/ui/count-up.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

export function CountUp({ end, duration = 1000, decimals = 0 }: { end: number; duration?: number; decimals?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + increment, end);
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count.toLocaleString('en-IN', { maximumFractionDigits: decimals })}</span>;
}
```

---

## Accessibility Standards (WCAG 2.1 AA)

Every component must meet these requirements:

```
Color contrast:
  - Normal text:  minimum 4.5:1 ratio
  - Large text:   minimum 3:1 ratio
  - UI components:minimum 3:1 ratio
  - Use Colour Contrast Analyzer to verify all new colors

Keyboard navigation:
  - All interactive elements reachable with Tab
  - Visible focus ring on all focusable elements (focus-visible:ring-2 ring-ring)
  - Escape closes all modals, sheets, dropdowns
  - Arrow keys navigate menus and tabs
  - Enter/Space activates buttons

Semantic HTML:
  - <main> wraps page content
  - <nav> for navigation elements
  - <aside> for sidebars
  - Headings are hierarchical (h1 → h2 → h3, never skipping)
  - <table> with proper <thead>, <tbody>, <th scope="col/row">
  - <form> with <label> linked to every <input> via htmlFor

ARIA:
  - aria-label on icon-only buttons
  - aria-expanded on collapsible elements
  - aria-current="page" on active nav links
  - aria-live="polite" on toast notifications
  - role="status" on loading states
  - aria-sort on sortable table headers

Images:
  - Decorative images: aria-hidden="true"
  - Informative images: meaningful alt text
  - Never use text inside images (except logos with alt text)
```

---

## Animation Guidelines

```typescript
// web/src/lib/animations.ts
// Framer Motion variants — use these consistently

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
};

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

// Stat card grid — stagger the cards in on load
export const statCardGrid = {
  animate: { transition: { staggerChildren: 0.08 } },
};
```

Rules:
- **Duration:** 150–350ms for UI interactions, never more than 500ms
- **Easing:** easeOut for elements entering, easeIn for leaving
- **Reduce motion:** always respect `prefers-reduced-motion`
- **Never** animate layout-causing properties (width, height) — use transform and opacity only

---

## Storybook Setup

```bash
cd web
npx storybook@latest init --type nextjs
pnpm storybook dev -p 6006
```

Every component in `/components/ui/` gets a `.stories.tsx` file with:
- Default story (all variants)
- Dark mode story
- Loading/skeleton story
- Empty state story
- Accessibility check via `@storybook/addon-a11y`

---

## Package Installation

```bash
cd web
pnpm add framer-motion
pnpm add @tanstack/react-table
pnpm add next-themes
pnpm add class-variance-authority clsx tailwind-merge
pnpm add tailwindcss-animate @tailwindcss/typography
pnpm add lucide-react
pnpm add recharts
pnpm add @radix-ui/react-slot
pnpm add date-fns
pnpm add zustand

# Dev
pnpm add -D @storybook/nextjs @storybook/addon-a11y @storybook/addon-docs
```

---

## Testing — Web Phase 1

```bash
# Visual regression: every component renders correctly
pnpm storybook build
pnpm playwright test --project=design-system

# Accessibility audit
pnpm axe-cli http://localhost:3000 --tags wcag2a,wcag2aa

# Contrast checker
pnpm add -D @accessibility/contrast-checker
pnpm run check-contrast
```

```typescript
// web/src/components/ui/stat-card.test.tsx
import { render, screen } from '@testing-library/react';
import { StatCard } from './stat-card';
import { Users } from 'lucide-react';

test('renders title and value', () => {
  render(<StatCard title="Total Students" value={1240} icon={Users} />);
  expect(screen.getByText('Total Students')).toBeInTheDocument();
  expect(screen.getByText('1,240')).toBeInTheDocument();
});

test('shows skeleton when loading', () => {
  render(<StatCard title="Total Students" value={0} icon={Users} loading />);
  expect(screen.queryByText('Total Students')).not.toBeInTheDocument();
});

test('has correct ARIA attributes when clickable', () => {
  render(<StatCard title="Total Students" value={1240} icon={Users} onClick={() => {}} />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

---

## Antigravity Prompt for Web Phase 1

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-01-design-system/SKILL.md

Build Web Phase 1 — Design System:
1. Set up globals.css with full CSS variable system (light + dark palette)
2. Configure Tailwind v4 with custom tokens (colors, radius, shadows, animations)
3. Install and configure Plus Jakarta Sans + Inter + JetBrains Mono via next/font
4. Install all required packages (framer-motion, @tanstack/react-table, etc.)
5. Build StatCard component with CountUp animation and skeleton loader
6. Build DataTable with TanStack Table — sort, search, pagination, skeleton rows
7. Build PageHeader with breadcrumbs and action slot
8. Build StatusBadge with full status color map
9. Build EmptyState with icon, title, description, action button
10. Build CountUp with framer-motion useInView trigger
11. Create animations.ts with Framer Motion variants
12. Set up Storybook with a11y addon
13. Write component tests for StatCard, DataTable, StatusBadge
14. Run: pnpm storybook build (should pass) && pnpm test
```
