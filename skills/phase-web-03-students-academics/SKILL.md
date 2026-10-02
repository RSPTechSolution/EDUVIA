---
name: schoolerp-web-phase-03-students-academics
description: >
  Web Phase 3 — Students module (list, profile, bulk import wizard, promotions)
  and Academics module (subjects, visual timetable builder, syllabus tracker,
  homework board, lesson planner, certificate designer).
  Use when building student management or academic module pages.
---

# Web Phase 3 — Students & Academics
## Next.js 15 · React Query · TanStack Table · Framer Motion

---

## Students Module

### Student List Page `/students`

```tsx
// web/src/app/(dashboard)/students/page.tsx
// Key UI elements:

// 1. PageHeader with breadcrumbs + action buttons
<PageHeader
  title="Students"
  description="Manage all student records, admissions and promotions"
  breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]}
  actions={
    <>
      <Button variant="outline" onClick={openImport}>
        <Upload className="mr-2 h-4 w-4" /> Import CSV
      </Button>
      <Button variant="outline" onClick={exportStudents}>
        <Download className="mr-2 h-4 w-4" /> Export
      </Button>
      <Button onClick={() => router.push('/students/new')}>
        <Plus className="mr-2 h-4 w-4" /> Add Student
      </Button>
    </>
  }
/>

// 2. Filters bar: Class picker, Section picker, Status filter, Gender filter
// All filters use URL search params so state survives refresh/share

// 3. Stats summary row above table
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  <MiniStat label="Total" value={stats.total} color="blue" />
  <MiniStat label="Active" value={stats.active} color="green" />
  <MiniStat label="Inactive" value={stats.inactive} color="gray" />
  <MiniStat label="Alumni" value={stats.alumni} color="purple" />
</div>

// 4. DataTable columns
const columns: ColumnDef<Student>[] = [
  { id: 'select', header: SelectAllHeader, cell: SelectRowCell },
  {
    accessorKey: 'photo',
    header: '',
    cell: ({ row }) => (
      <Avatar className="h-9 w-9">
        <AvatarImage src={row.original.photo} alt={row.original.first_name} />
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {row.original.first_name[0]}{row.original.last_name[0]}
        </AvatarFallback>
      </Avatar>
    ),
  },
  { accessorKey: 'admission_no', header: 'Adm. No.',
    cell: ({ getValue }) => <code className="font-mono text-xs">{getValue()}</code> },
  {
    id: 'name',
    header: 'Student',
    cell: ({ row }) => (
      <div>
        <Link href={`/students/${row.original.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline">
          {row.original.first_name} {row.original.last_name}
        </Link>
        <p className="text-xs text-muted-foreground">{row.original.parent_phone}</p>
      </div>
    ),
  },
  { accessorKey: 'class_name',   header: 'Class' },
  { accessorKey: 'section_name', header: 'Section' },
  { accessorKey: 'gender',       header: 'Gender' },
  { accessorKey: 'status',       header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()} /> },
  { id: 'actions', cell: StudentActionsMenu },
];

// 5. Bulk action bar (appears when rows selected)
// "Promote selected", "Export selected", "Deactivate selected", "Send message"
```

### Student Profile Page `/students/[id]`

```tsx
// Layout: split — left column (profile card) + right column (tabbed content)

// Left column — Profile Card
<Card className="sticky top-20">
  <CardContent className="pt-6">
    <div className="flex flex-col items-center gap-3 text-center">
      <Avatar className="h-24 w-24 ring-4 ring-primary/20">
        <AvatarImage src={student.photo} />
        <AvatarFallback className="text-2xl font-bold">{initials}</AvatarFallback>
      </Avatar>
      <div>
        <h2 className="font-display text-xl font-bold">{student.first_name} {student.last_name}</h2>
        <p className="text-sm text-muted-foreground">{student.admission_no}</p>
        <StatusBadge status={student.status} className="mt-2" />
      </div>
    </div>
    <Separator className="my-4" />
    <ProfileField label="Class"    value={`${student.class_name} — ${student.section_name}`} />
    <ProfileField label="DOB"      value={formatDate(student.date_of_birth)} />
    <ProfileField label="Gender"   value={student.gender} />
    <ProfileField label="Blood"    value={student.blood_group} />
    <ProfileField label="Phone"    value={student.phone} />
    <ProfileField label="Email"    value={student.email} />
    <ProfileField label="Joined"   value={formatDate(student.admission_date)} />
  </CardContent>
</Card>

// Right column — Tabs
<Tabs defaultValue="overview">
  <TabsList className="w-full">
    <TabsTrigger value="overview">  Overview  </TabsTrigger>
    <TabsTrigger value="academics"> Academics </TabsTrigger>
    <TabsTrigger value="attendance">Attendance </TabsTrigger>
    <TabsTrigger value="fees">      Fees       </TabsTrigger>
    <TabsTrigger value="parents">   Parents    </TabsTrigger>
    <TabsTrigger value="documents"> Documents  </TabsTrigger>
    <TabsTrigger value="activity">  Activity   </TabsTrigger>
  </TabsList>
  // Each tab fetches its own data lazily
</Tabs>
```

### Bulk Import Wizard

```tsx
// Multi-step Sheet: Step 1 → 2 → 3 → 4
// Step 1: Download template CSV button + drag-drop upload zone
// Step 2: Preview table (first 10 rows) — valid rows green, error rows red with error message
// Step 3: Field mapping (auto-detected, override dropdowns)
// Step 4: Confirmation — "32 students will be imported, 2 rows have errors (will be skipped)"
// Success: animated checkmark + "View imported students" button

const STEPS = ['Upload File', 'Preview & Validate', 'Map Fields', 'Confirm Import'];
```

---

## Academics Module

### Visual Timetable Builder `/academics/timetable`

```tsx
// Full-width grid: rows = periods (1-8), columns = Mon-Sat
// Each cell = Subject select + Teacher select
// Color-coded by subject (stored in subject.color)
// Clash indicator: red border + tooltip "Mr. Sharma is teaching Maths at this time"

// State: 2D array [period][dayOfWeek] = { subjectId, teacherId }
// On cell change → check clash via useMemo → highlight conflicts

const TimetableCell = ({ period, day, slot, onEdit, hasClash }: TimetableCellProps) => (
  <button
    onClick={() => onEdit(period, day)}
    className={cn(
      'relative h-16 w-full rounded-lg border-2 p-2 text-left text-xs transition-all',
      'hover:border-primary/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
      slot ? 'bg-card border-transparent shadow-card' : 'border-dashed border-border bg-muted/30',
      hasClash && 'border-destructive bg-destructive/5',
    )}
    aria-label={slot ? `Period ${period} ${['Mon','Tue','Wed','Thu','Fri','Sat'][day-1]}: ${slot.subject_name}` : `Add period ${period} ${['Mon','Tue','Wed','Thu','Fri','Sat'][day-1]}`}
  >
    {slot ? (
      <>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: slot.subject_color }} aria-hidden />
        <p className="mt-1 font-semibold text-foreground truncate">{slot.subject_name}</p>
        <p className="text-muted-foreground truncate">{slot.teacher_name}</p>
        {hasClash && <AlertCircle className="absolute right-1 top-1 h-3.5 w-3.5 text-destructive" aria-label="Scheduling conflict" />}
      </>
    ) : (
      <Plus className="h-4 w-4 text-muted-foreground/40 m-auto" aria-hidden />
    )}
  </button>
);
```

### Syllabus Tracker

```tsx
// Subject cards with progress bars
// Each card shows: Subject name, teacher, completion % ring chart
// Click → expand to topic list with checkboxes

<Card className="group hover:shadow-hover transition-shadow">
  <CardContent className="p-5">
    <div className="flex items-center gap-4">
      <CircularProgress value={subject.completionPct} size={56} strokeWidth={4}
        color="hsl(var(--primary))" aria-label={`${subject.completionPct}% complete`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{subject.name}</p>
        <p className="text-sm text-muted-foreground">{subject.teacher_name}</p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={subject.completionPct} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground tabular-nums">{subject.completedTopics}/{subject.totalTopics}</span>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Antigravity Prompt for Web Phase 3

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-03-students-academics/SKILL.md

Build Web Phase 3 — Students & Academics:
1. Students list page: DataTable with avatar column, status badges, URL-param filters,
   stats summary row, bulk selection + bulk action bar
2. Student profile page: sticky profile card left + tabbed content right
   (overview, academics, attendance, fees, parents, documents, activity timeline)
3. Student create/edit form: Sheet slide-over, multi-tab form (Personal/Academic/Contact/Parents)
4. Bulk import wizard: 4-step Sheet with drag-drop upload, preview table, field mapping, confirm
5. Academics: subjects list with color picker, timetable builder grid with clash detection,
   syllabus tracker with circular progress per subject + topic checkbox list
6. Homework board: Kanban-style (To Do / Submitted / Graded) with due date chips
7. All pages use PageHeader, Breadcrumbs, StatusBadge from design system
8. All API calls via React Query (useQuery, useMutation) with loading skeletons
9. Run: pnpm build && pnpm test
```
