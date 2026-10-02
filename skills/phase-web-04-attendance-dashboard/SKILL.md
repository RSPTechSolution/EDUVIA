---
name: schoolerp-web-phase-04-attendance-dashboard
description: >
  Web Phase 4 — Main dashboard (stat cards, charts, quick actions, activity feed)
  and full Attendance module (daily marking, monthly calendar heatmap, biometric
  device management with live punch feed, QR logs, and reports).
---

# Web Phase 4 — Dashboard & Attendance
## Recharts · React Query · TanStack Table

---

## Main Dashboard `/dashboard`

### Layout — 3-Zone Design

```
┌─────────────────────────────────────────────────────────────┐
│  ZONE 1: KPI Stats Row (4 cards, full width)                │
├──────────────────────────────────────┬──────────────────────┤
│  ZONE 2A: Charts (2/3 width)         │  ZONE 2B: Sidebar    │
│  • Attendance Trend (LineChart)      │  • Quick Actions     │
│  • Fee Collection (BarChart)         │  • Recent Activity   │
│  • Student Distribution (AreaChart)  │  • Today's Events    │
├──────────────────────────────────────┴──────────────────────┤
│  ZONE 3: Data Tables Row                                     │
│  • Fee Defaulters (top 5)  │  Upcoming Exams  │  Birthdays  │
└─────────────────────────────────────────────────────────────┘
```

### KPI Stat Cards

```tsx
// web/src/app/(dashboard)/dashboard/page.tsx

const stats = [
  {
    title: 'Total Students',
    value: data.total_students,
    icon: Users,
    iconColor: 'text-blue-500',
    trend: data.students_trend,
    trendLabel: 'vs last month',
    onClick: () => router.push('/students'),
  },
  {
    title: "Today's Attendance",
    value: data.attendance_rate,
    suffix: '%',
    icon: CalendarCheck,
    iconColor: data.attendance_rate >= 85 ? 'text-green-500' : 'text-amber-500',
    trend: data.attendance_trend,
  },
  {
    title: 'Fees Collected Today',
    value: data.fees_today,
    prefix: '₹',
    icon: Wallet,
    iconColor: 'text-emerald-500',
    trend: data.fees_trend,
  },
  {
    title: 'Outstanding Fees',
    value: data.fees_outstanding,
    prefix: '₹',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    onClick: () => router.push('/fees?status=unpaid'),
  },
];

<motion.div
  variants={statCardGrid}
  initial="initial"
  animate="animate"
  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
>
  {stats.map((stat, i) => (
    <motion.div key={i} variants={staggerItem}>
      <StatCard {...stat} loading={isLoading} />
    </motion.div>
  ))}
</motion.div>
```

### Attendance Trend Chart

```tsx
// 30-day attendance rate line chart with area fill
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<Card>
  <CardHeader>
    <CardTitle>Attendance Trend</CardTitle>
    <CardDescription>Daily attendance rate — last 30 days</CardDescription>
    <div className="ml-auto flex items-center gap-2">
      <RangePicker value={range} onChange={setRange} options={['7d','30d','90d']} />
    </div>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={attendanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(d) => format(new Date(d), 'd MMM')} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip content={<AttendanceTooltip />} />
        <Area type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5}
          fill="url(#attGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
        {/* Reference line at 75% */}
        <ReferenceLine y={75} stroke="hsl(var(--warning))" strokeDasharray="4 4"
          label={{ value: '75% min', position: 'right', fontSize: 10 }} />
      </AreaChart>
    </ResponsiveContainer>
  </CardContent>
</Card>
```

### Fee Collection Bar Chart

```tsx
// Monthly fee collection with stacked bars (category breakdown)
<BarChart data={feeData}>
  <Bar dataKey="tuition_fee" name="Tuition" fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
  <Bar dataKey="transport_fee" name="Transport" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
  <Bar dataKey="other_fee" name="Other" fill="hsl(var(--chart-3))" radius={[3,3,0,0]} />
</BarChart>
```

### Quick Actions Panel

```tsx
// Right sidebar — 3-column grid of action buttons
const QUICK_ACTIONS = [
  { label: 'Add Student',   icon: UserPlus,  href: '/students/new',   color: 'blue' },
  { label: 'Mark Absent',   icon: UserX,     href: '/attendance',     color: 'red' },
  { label: 'Collect Fee',   icon: Receipt,   href: '/fees/collect',   color: 'green' },
  { label: 'Send Notice',   icon: Bell,      href: '/communication',  color: 'purple' },
  { label: 'New Exam',      icon: FileText,  href: '/exams/new',      color: 'orange' },
  { label: 'Gate Pass',     icon: DoorOpen,  href: '/security',       color: 'gray' },
];
```

---

## Attendance Module `/attendance`

### Daily Marking Page

```tsx
// Layout: Filters top → Student card grid below → Floating save bar

// Filters: Date picker, Class select, Section select, Period toggle
// "Mark All Present" button with confirmation

// Student Card — high-density grid
const AttendanceCard = ({ student, status, onChange }: AttendanceCardProps) => (
  <div className={cn(
    'rounded-xl border-2 p-3 transition-all duration-150 cursor-pointer select-none',
    'focus-within:ring-2 focus-within:ring-ring',
    status === 'present' ? 'border-success/30 bg-success/5' :
    status === 'absent'  ? 'border-destructive/30 bg-destructive/5' :
    status === 'late'    ? 'border-warning/30 bg-warning/5' :
                           'border-border bg-card hover:border-primary/30',
  )}>
    <div className="flex items-center gap-2.5 mb-2.5">
      <Avatar className="h-8 w-8">
        <AvatarImage src={student.photo} />
        <AvatarFallback className="text-[10px]">{student.first_name[0]}{student.last_name[0]}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {student.first_name} {student.last_name}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">{student.admission_no}</p>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-1" role="group" aria-label={`Attendance for ${student.first_name}`}>
      {(['present', 'absent', 'late', 'half_day'] as const).map((s) => (
        <button key={s}
          onClick={() => onChange(student.id, s)}
          className={cn(
            'rounded-md py-1 text-[10px] font-bold uppercase transition-colors',
            status === s
              ? s === 'present' ? 'bg-success text-white' :
                s === 'absent'  ? 'bg-destructive text-white' :
                s === 'late'    ? 'bg-warning text-white' :
                                  'bg-info text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20',
          )}
          aria-pressed={status === s}
          aria-label={s.replace('_', ' ')}
        >
          {s === 'half_day' ? 'H' : s[0].toUpperCase()}
        </button>
      ))}
    </div>
  </div>
);

// Floating save bar
<AnimatePresence>
  {isDirty && (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-3 shadow-xl">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{changedCount}</strong> records changed
        </p>
        <Button variant="outline" size="sm" onClick={resetChanges}>Reset</Button>
        <Button size="sm" onClick={saveAttendance} disabled={isSaving}>
          {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Save Attendance
        </Button>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### Monthly Calendar Heatmap

```tsx
// Calendar grid — each day cell is colored by attendance rate
// Rate ≥90% → green, 75-90% → yellow, <75% → red, no data → gray
// Click day → see breakdown for that day in a side panel

const getHeatColor = (rate: number | null) => {
  if (rate === null) return 'bg-muted';
  if (rate >= 90) return 'bg-success/70';
  if (rate >= 75) return 'bg-warning/70';
  return 'bg-destructive/60';
};
```

### Biometric Device Dashboard

```tsx
// Device cards showing: name, IP, last sync, punch mode, status indicator
// Live Punch Feed (auto-refreshes every 10s):
//   Scrolling list of recent punches — person name, time, in/out, device

// API Playground tab:
//   POST /iclock/cdata simulator — paste raw punch data → see response
//   Real-time punch test with highlighted response
```

---

## Antigravity Prompt for Web Phase 4

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-04-attendance-dashboard/SKILL.md

Build Web Phase 4 — Dashboard & Attendance:
1. Main dashboard: 4 StatCards (animated), AreaChart attendance trend (30-day),
   BarChart fee collection (stacked by category), Quick Actions grid,
   Recent Activity feed, fee defaulters mini-table, upcoming events list
2. Dashboard uses React Query with 60s auto-refetch, skeleton loading state
3. Attendance daily marking: filter bar (date/class/section/period), student
   card grid (P/A/L/H buttons, color-coded), "Mark All Present", floating save bar
4. Attendance monthly calendar heatmap with color coding by rate
5. Attendance reports: class summary table, student report with chart,
   <75% defaulter list with one-click SMS reminder
6. Biometric device dashboard: device cards, live punch feed (polling 10s),
   API playground tab
7. QR scan logs table with timeline view
8. All charts use CSS variables for colors (theme-aware)
9. Run: pnpm build && pnpm test
```
