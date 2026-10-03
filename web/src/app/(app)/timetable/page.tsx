"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, Copy, Settings2, UserCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { ClassesIllustration } from "@/components/illustrations";
import { FadeIn } from "@/components/motion/primitives";
import { useCan } from "@/components/session-provider";
import { DAY_NAMES, TimetableGrid, colorOf, formatTime, slotKey } from "@/components/timetable/grid";
import { SlotDialog, type SlotTarget } from "@/components/timetable/slot-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api/client";
import type { ClassItem } from "@/lib/api/types";
import { initials } from "@/lib/format";
import {
  useAvailableTeachers, useClasses, usePeriods, useSectionTimetable, useSubjects, useTeacherTimetable, useTimetableTeachers,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

type Tab = "class" | "teacher" | "free";

function useParam(name: string): [string | null, (v: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  return [params.get(name), (v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(name, v); else next.delete(name);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }];
}

function sectionLabel(classes: ClassItem[] | undefined, sectionId: string | null) {
  for (const c of classes ?? []) for (const s of c.sections) if (s.id === sectionId) return `${c.name} – ${s.name}`;
  return "";
}

function CopyDialog({ open, onOpenChange, targetId, classes }: { open: boolean; onOpenChange: (o: boolean) => void; targetId: string; classes: ClassItem[] }) {
  const qc = useQueryClient();
  const [source, setSource] = useState("");
  const [withTeachers, setWithTeachers] = useState(true);
  const copy = useMutation({
    mutationFn: () => api<{ copied: number; with_teacher: number }>(`/timetable/sections/${targetId}/copy`, {
      method: "POST", body: { source_section_id: source, include_teachers: withTeachers },
    }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
      toast.success(`Copied ${data.copied} lessons`, {
        description: withTeachers ? `${data.with_teacher} kept their teacher; the rest need one (the teacher was busy).` : "Assign teachers to each lesson.",
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not copy"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy a timetable</DialogTitle>
          <DialogDescription>Replaces {sectionLabel(classes, targetId)}&apos;s timetable with another section&apos;s subjects.</DialogDescription>
        </DialogHeader>
        <Select value={source || undefined} onValueChange={(v) => setSource(String(v))}>
          <SelectTrigger className="w-full" aria-label="Copy from"><SelectValue placeholder="Copy from…">{source ? sectionLabel(classes, source) : undefined}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-72">
            {classes.flatMap((c) => c.sections.filter((s) => s.id !== targetId).map((s) => <SelectItem key={s.id} value={s.id}>{c.name} – {s.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>Keep teachers where they&apos;re free<span className="block text-xs text-muted-foreground">A teacher can&apos;t be in two classes at once.</span></span>
          <Switch checked={withTeachers} onCheckedChange={setWithTeachers} />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!source} onClick={() => copy.mutate()} loading={copy.isPending} loadingText="Copying…"><Copy aria-hidden />Copy timetable</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClassTab({ classes }: { classes: ClassItem[] }) {
  const can = useCan();
  const manage = can("timetable.manage");
  const [sectionId, setSectionId] = useParam("section");
  const current = sectionId ?? classes.find((c) => c.sections.length)?.sections[0]?.id ?? null;
  const cls = classes.find((c) => c.sections.some((s) => s.id === current));
  const view = useSectionTimetable(current);
  const subjects = useSubjects(manage);
  const [target, setTarget] = useState<SlotTarget | null>(null);
  const [copying, setCopying] = useState(false);
  const missing = view.data?.entries.filter((e) => !e.teacher_id).length ?? 0;
  const legend = useMemo(() => {
    const m = new Map<string, { name: string; color: string; n: number }>();
    for (const e of view.data?.entries ?? []) {
      const x = m.get(e.subject_id) ?? { name: e.subject_name, color: e.subject_color, n: 0 };
      x.n += 1;
      m.set(e.subject_id, x);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [view.data]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={cls?.id ?? ""} onValueChange={(v) => setSectionId(classes.find((c) => c.id === v)?.sections[0]?.id ?? null)}>
          <SelectTrigger className="h-9 sm:w-44" aria-label="Class"><SelectValue placeholder="Class">{cls?.name}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-72">{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <div role="tablist" aria-label="Section" className="inline-flex flex-wrap gap-1 rounded-lg border p-0.5">
          {cls?.sections.map((s) => (
            <button key={s.id} role="tab" type="button" aria-selected={s.id === current} onClick={() => setSectionId(s.id)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", s.id === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {missing > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
              <AlertTriangle className="size-3.5" aria-hidden />{missing} lesson{missing > 1 ? "s" : ""} need a teacher
            </span>
          )}
          {manage && current && <Button variant="outline" size="sm" onClick={() => setCopying(true)}><Copy aria-hidden />Copy from…</Button>}
        </div>
      </div>
      {view.data ? (
        <FadeIn key={current}>
          {view.data.subtitle && <p className="mb-2 text-sm text-muted-foreground">{view.data.subtitle} · {view.data.entries.length} lessons a week</p>}
          <TimetableGrid
            view={view.data}
            editable={manage}
            onCellClick={manage && subjects.data ? (day, period, entry) => setTarget({ sectionId: current!, sectionLabel: view.data!.title, day, period, entry }) : undefined}
          />
          {legend.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Periods per week by subject">
              {legend.map((l) => <li key={l.name} className="flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", colorOf(l.color).dot)} />{l.name} <span className="tabular">{l.n}</span></li>)}
            </ul>
          )}
        </FadeIn>
      ) : <Skeleton className="h-[480px] rounded-xl" />}
      {manage && <SlotDialog target={target} subjects={subjects.data ?? []} onClose={() => setTarget(null)} />}
      {manage && current && <CopyDialog open={copying} onOpenChange={setCopying} targetId={current} classes={classes} />}
    </>
  );
}

function TeacherTab() {
  const teachers = useTimetableTeachers();
  const subjects = useSubjects();
  const [teacherId, setTeacherId] = useParam("teacher");
  const current = teacherId ?? teachers.data?.[0]?.id ?? null;
  const teacher = teachers.data?.find((t) => t.id === current);
  const view = useTeacherTimetable(current);
  const blocked = useMemo(() => new Set(teacher?.unavailable.map((u) => slotKey(u.day, u.period_id))), [teacher]);
  const subjectNames = teacher?.subject_ids.map((id) => subjects.data?.find((s) => s.id === id)?.name).filter(Boolean).join(", ");

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={current ?? ""} onValueChange={(v) => setTeacherId(String(v))}>
          <SelectTrigger className="h-9 sm:w-72" aria-label="Teacher"><SelectValue placeholder="Choose a teacher">{teacher?.full_name}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-80">
            {teachers.data?.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}<span className="ml-auto text-xs text-muted-foreground tabular">{t.periods_per_week}/wk</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        {teacher && (
          <p className="text-sm text-muted-foreground">
            {teacher.designation ?? "Teacher"}{subjectNames ? ` · ${subjectNames}` : ""} · <span className="font-medium text-foreground tabular">{teacher.periods_per_week}</span> periods a week
          </p>
        )}
      </div>
      {view.data ? <FadeIn key={current}><TimetableGrid view={view.data} blocked={blocked} /></FadeIn> : <Skeleton className="h-[480px] rounded-xl" />}
    </>
  );
}

function FreeTab() {
  const periods = usePeriods();
  const subjects = useSubjects();
  const lessons = periods.data?.filter((p) => !p.is_break) ?? [];
  const today = new Date().getDay();
  const [day, setDay] = useState(today >= 1 && today <= 6 ? today : 1);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState("all");
  const period = lessons.find((p) => p.id === periodId) ?? lessons[0];
  const available = useAvailableTeachers(period ? { day, period_id: period.id, ...(subjectId !== "all" ? { subject_id: subjectId } : {}) } : null);
  const free = available.data?.filter((t) => t.status === "free" && (subjectId === "all" || t.qualified)) ?? [];
  const busy = available.data?.filter((t) => t.status === "busy") ?? [];

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Find who can cover a lesson: pick a day and period to see which teachers are free.</p>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
          <SelectTrigger className="h-9 sm:w-40" aria-label="Day"><SelectValue>{DAY_NAMES[day - 1]}</SelectValue></SelectTrigger>
          <SelectContent>{DAY_NAMES.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={period?.id ?? ""} onValueChange={(v) => setPeriodId(String(v))}>
          <SelectTrigger className="h-9 sm:w-56" aria-label="Period"><SelectValue>{period ? `${period.name} · ${formatTime(period.start_time)}` : "Period"}</SelectValue></SelectTrigger>
          <SelectContent>{lessons.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatTime(p.start_time)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subjectId} onValueChange={(v) => setSubjectId(String(v))}>
          <SelectTrigger className="h-9 sm:w-52" aria-label="Subject"><SelectValue>{subjectId === "all" ? "Any subject" : subjects.data?.find((s) => s.id === subjectId)?.name}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Any subject</SelectItem>
            {subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <h2 className="mb-3 flex items-center gap-2 font-heading font-bold"><UserCheck className="size-5 text-success" aria-hidden />Free <span className="text-sm font-normal text-muted-foreground">({free.length})</span></h2>
            {available.isLoading ? <Skeleton className="h-40" /> : free.length === 0 ? <p className="text-sm text-muted-foreground">Nobody matching is free then.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {free.map((t) => (
                  <li key={t.id} className="card-lift flex items-center gap-2.5 rounded-lg border p-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-xs font-semibold text-success">{initials(t.full_name)}</span>
                    <span className="min-w-0">
                      <Link href={`/timetable?tab=teacher&teacher=${t.id}`} className="block truncate text-sm font-medium hover:text-primary hover:underline">{t.full_name}</Link>
                      <span className="block text-xs text-muted-foreground">{t.periods_that_day} lessons that day</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2 className="mb-3 font-heading font-bold">Teaching then <span className="text-sm font-normal text-muted-foreground">({busy.length})</span></h2>
            <ul className="max-h-96 divide-y overflow-y-auto text-sm">
              {busy.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate">{t.full_name}</span><span className="shrink-0 text-xs text-muted-foreground">{t.busy_with}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TimetablePage() {
  const can = useCan();
  const classes = useClasses();
  const [tabParam, setTab] = useParam("tab");
  const tab = (tabParam as Tab) ?? "class";
  const noClasses = classes.data && classes.data.every((c) => !c.sections.length);

  return (
    <>
      <PageHeader
        title="Timetable"
        description="Weekly lessons for every class and teacher. A teacher can never be booked in two places at once."
        actions={can("timetable.manage") && <Link href="/timetable/setup" className={buttonVariants({ variant: "outline", className: "h-9" })}><Settings2 aria-hidden />Subjects, periods & teachers</Link>}
      />
      {noClasses ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClassesIllustration />} title="Add classes first"
          description="Timetables are made for each section." action={<Link href="/academics/classes" className={buttonVariants()}>Set up classes</Link>} />
      ) : (
        <>
          <Tabs value={tab} onValueChange={(v) => setTab(v === "class" ? null : String(v))} className="mb-5">
            <TabsList>
              <TabsTrigger value="class"><CalendarRange aria-hidden />By class</TabsTrigger>
              <TabsTrigger value="teacher">By teacher</TabsTrigger>
              <TabsTrigger value="free">Free teachers</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "class" && (classes.data ? <ClassTab classes={classes.data} /> : <Skeleton className="h-[520px] rounded-xl" />)}
          {tab === "teacher" && <TeacherTab />}
          {tab === "free" && <FreeTab />}
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="timetable.view">
      <Suspense><TimetablePage /></Suspense>
    </PermissionGate>
  );
}
