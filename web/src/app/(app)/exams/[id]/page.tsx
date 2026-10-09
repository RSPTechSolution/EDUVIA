"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CheckCircle2, Download, Eye, EyeOff, FileText, MessageSquareText, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { ExamStatusBadge, GradeBadge, KIND, fmtMarks } from "@/components/exams/shared";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { useCan, useSession } from "@/components/session-provider";
import { colorOf } from "@/components/timetable/grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { ExamDetail, ExamPaper, StudentResult } from "@/lib/api/types";
import { useClasses, useExam, useMarksSheets, useSectionResults, useSubjects } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errorText = (e: unknown, fallback: string) => e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : fallback;

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

// ---- mark sheets ------------------------------------------------------------------------------

function MarksTab({ exam }: { exam: ExamDetail }) {
  const sheets = useMarksSheets(exam.id);
  if (!sheets.data) return <Skeleton className="h-60 rounded-xl" />;
  if (!sheets.data.length) return <EmptyState className="rounded-2xl border bg-card" title="No mark sheets for you" description="You'll see a sheet for each subject you teach once the date sheet includes it." />;
  const pending = sheets.data.filter((s) => s.entered < s.students).length;
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{pending ? `${pending} of ${sheets.data.length} sheets still need marks.` : "All your marks are in."}</p>
      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sheets.data.map((s) => {
          const done = s.students > 0 && s.entered >= s.students;
          return (
            <StaggerItem key={`${s.paper_id}${s.section_id}`}>
              <Link href={`/exams/${exam.id}/marks/${s.paper_id}/${s.section_id}`}
                className={cn("card-lift flex items-center gap-3 rounded-xl border bg-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring", !done && "border-primary/30")}>
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg border", colorOf(s.subject_color).cell)}>
                  {done ? <CheckCircle2 className="size-5" aria-label="Done" /> : <FileText className="size-5" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.section_label} · {s.subject_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.exam_date ? format(parseISO(s.exam_date), "EEE d MMM") : "Date not set"} · out of {fmtMarks(s.max_marks)} · {s.entered}/{s.students} entered
                  </span>
                </span>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </>
  );
}

// ---- date sheet -------------------------------------------------------------------------------

type Row = { key: string; subject_id: string; exam_date: string; max_marks: string; pass_marks: string };

function PapersDialog({ exam, classId, className, papers, onClose }: { exam: ExamDetail; classId: string | null; className: string; papers: ExamPaper[]; onClose: () => void }) {
  const qc = useQueryClient();
  const subjects = useSubjects(Boolean(classId));
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (classId) {
      setRows(papers.map((p) => ({ key: p.id, subject_id: p.subject_id, exam_date: p.exam_date ?? "", max_marks: String(p.max_marks), pass_marks: String(p.pass_marks) })));
      setError(null);
    }
  }, [classId, papers]);
  const save = useMutation({
    mutationFn: () => api(`/exams/${exam.id}/papers`, {
      method: "PUT",
      body: { class_id: classId, papers: rows.filter((r) => r.subject_id).map((r) => ({ subject_id: r.subject_id, exam_date: r.exam_date || null, max_marks: Number(r.max_marks), pass_marks: Number(r.pass_marks) })) },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); toast.success(`Date sheet saved for ${className}`); onClose(); },
    onError: (e) => setError(errorText(e, "Could not save")),
  });
  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const last = rows.at(-1);
  return (
    <Dialog open={Boolean(classId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Date sheet · {className}</DialogTitle><DialogDescription>{exam.name}. Papers with marks can&apos;t be removed.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_5rem_5rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span>Subject</span><span>Date</span><span>Max</span><span>Pass</span><span />
          </div>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_9rem_5rem_5rem_2rem] sm:border-0 sm:p-0">
              <Select value={r.subject_id || undefined} onValueChange={(v) => set(r.key, { subject_id: String(v) })}>
                <SelectTrigger className="col-span-2 h-9 w-full sm:col-span-1" aria-label="Subject"><SelectValue placeholder="Subject">{subjects.data?.find((s) => s.id === r.subject_id)?.name}</SelectValue></SelectTrigger>
                <SelectContent className="max-h-72">{subjects.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" aria-label="Date" value={r.exam_date} min={exam.start_date ?? undefined} max={exam.end_date ?? undefined} onChange={(e) => set(r.key, { exam_date: e.target.value })} className="h-9" />
              <Input type="number" aria-label="Maximum marks" min={1} value={r.max_marks} onChange={(e) => set(r.key, { max_marks: e.target.value })} className="h-9" />
              <Input type="number" aria-label="Pass marks" min={0} value={r.pass_marks} onChange={(e) => set(r.key, { pass_marks: e.target.value })} className="h-9" />
              <Button variant="ghost" size="icon" className="size-9" aria-label="Remove paper" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}><Trash2 aria-hidden /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { key: crypto.randomUUID(), subject_id: "", exam_date: "", max_marks: last?.max_marks ?? "100", pass_marks: last?.pass_marks ?? "33" }])}>
            <Plus aria-hidden />Add paper
          </Button>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving…">Save date sheet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FromTimetableDialog({ exam, open, onOpenChange }: { exam: ExamDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const classes = useClasses(open);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [max, setMax] = useState(exam.kind === "unit_test" ? "25" : "80");
  const [pass, setPass] = useState(exam.kind === "unit_test" ? "8" : "27");
  useEffect(() => { if (open && classes.data) setPicked(new Set(classes.data.map((c) => c.id))); }, [open, classes.data]);
  const run = useMutation({
    mutationFn: () => api<{ added: number }>(`/exams/${exam.id}/papers/from-timetable`, { method: "POST", body: { class_ids: [...picked], max_marks: Number(max), pass_marks: Number(pass) } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["exams"] }); onOpenChange(false); toast.success(`${data.added} papers added`, { description: "Set the dates class by class, or remove subjects that aren't examined." }); },
    onError: (e) => toast.error(errorText(e, "Could not add papers")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add papers from the timetable</DialogTitle><DialogDescription>One paper for each subject a class studies. Existing papers are kept.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {classes.data?.map((c) => {
            const on = picked.has(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => setPicked((s) => { const n = new Set(s); if (on) n.delete(c.id); else n.add(c.id); return n; })}
                className={cn("rounded-full border px-3 py-1 text-sm transition", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{c.name}</button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">Maximum marks<Input type="number" className="mt-1" value={max} onChange={(e) => setMax(e.target.value)} /></label>
          <label className="text-sm font-medium">Pass marks<Input type="number" className="mt-1" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => run.mutate()} disabled={!picked.size} loading={run.isPending} loadingText="Adding…"><Sparkles aria-hidden />Add papers</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DateSheetTab({ exam }: { exam: ExamDetail }) {
  const can = useCan();
  const manage = can("exams.manage") && !exam.published_at;
  const [editing, setEditing] = useState<{ id: string; name: string; papers: ExamPaper[] } | null>(null);
  const [auto, setAuto] = useState(false);
  return (
    <>
      {manage && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAuto(true)}><Sparkles aria-hidden />Add papers from timetable</Button>
        </div>
      )}
      {exam.classes_detail.length === 0 ? (
        <EmptyState className="rounded-2xl border bg-card" title="No date sheet yet" description={manage ? "Add papers from the timetable to start." : "The office hasn't set the date sheet yet."} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {exam.classes_detail.map((c) => (
            <Card key={c.class_id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{c.class_name}</CardTitle>
                {manage && <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.class_id, name: c.class_name, papers: c.papers })}><Pencil aria-hidden />Edit</Button>}
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <caption className="sr-only">Date sheet for {c.class_name}</caption>
                  <thead className="text-xs text-muted-foreground"><tr><th scope="col" className="pb-2 text-left font-medium">Date</th><th scope="col" className="pb-2 text-left font-medium">Subject</th><th scope="col" className="pb-2 text-right font-medium">Max</th><th scope="col" className="pb-2 text-right font-medium">Marks in</th></tr></thead>
                  <tbody className="divide-y">
                    {c.papers.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 whitespace-nowrap text-muted-foreground">{p.exam_date ? format(parseISO(p.exam_date), "EEE d MMM") : "—"}</td>
                        <td className="py-1.5"><span className={cn("mr-2 inline-block size-2 rounded-full", colorOf(p.subject_color).dot)} aria-hidden />{p.subject_name}</td>
                        <td className="py-1.5 text-right tabular">{fmtMarks(p.max_marks)}</td>
                        <td className={cn("py-1.5 text-right tabular", p.marks_entered >= p.students ? "text-success" : "text-muted-foreground")}>{p.marks_entered}/{p.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PapersDialog exam={exam} classId={editing?.id ?? null} className={editing?.name ?? ""} papers={editing?.papers ?? []} onClose={() => setEditing(null)} />
      <FromTimetableDialog exam={exam} open={auto} onOpenChange={setAuto} />
    </>
  );
}

// ---- results ----------------------------------------------------------------------------------

function RemarkDialog({ examId, student, onClose }: { examId: string; student: StudentResult | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  useEffect(() => { if (student) setText(student.remark ?? ""); }, [student]);
  const save = useMutation({
    mutationFn: () => api(`/exams/${examId}/remarks/${student!.student_id}`, { method: "PUT", body: { remark: text } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams", "results"] }); toast.success("Remark saved"); onClose(); },
    onError: (e) => toast.error(errorText(e, "Could not save")),
  });
  return (
    <Dialog open={Boolean(student)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Report-card remark</DialogTitle><DialogDescription>{student?.name} · shown on the report card</DialogDescription></DialogHeader>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={500} aria-label="Remark" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving…">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsTab({ exam }: { exam: ExamDetail }) {
  const me = useSession();
  const can = useCan();
  const classes = useClasses();
  const examClasses = new Set(exam.classes_detail.map((c) => c.class_id));
  const sections = useMemo(() => (classes.data ?? []).filter((c) => examClasses.has(c.id)).flatMap((c) => c.sections.map((s) => ({ id: s.id, label: `${c.name} – ${s.name}`, teacher: s.class_teacher_id }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes.data, exam.classes_detail]);
  const [sectionParam, setSection] = useParam("section");
  const current = sectionParam ?? sections.find((s) => s.teacher === me.id)?.id ?? sections[0]?.id ?? null;
  const res = useSectionResults(exam.id, current);
  const [remarking, setRemarking] = useState<StudentResult | null>(null);
  const r = res.data;
  const canRemark = can("exams.manage") || sections.find((s) => s.id === current)?.teacher === me.id;
  const csv = () => {
    if (!r) return;
    const head = ["Roll", "Name", ...r.subjects.map((s) => s.subject_name), "Total", "Percent", "Grade", "Rank", "Result"];
    const lines = r.students.map((s) => [s.roll_no ?? "", s.name, ...s.subjects.map((x) => (x.absent ? "AB" : x.marks ?? "")), s.total, s.percent ?? "", s.grade ?? "", s.rank ?? "", s.passed ? "Pass" : "Needs improvement"]);
    const blob = new Blob([[head, ...lines].map((l) => l.map((v) => `"${v}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${r.exam_name}-${r.section_label}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  if (!sections.length) return <EmptyState className="rounded-2xl border bg-card" title="No results yet" description="Add the date sheet first." />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={current ?? ""} onValueChange={(v) => setSection(String(v))}>
          <SelectTrigger className="h-9 w-56" aria-label="Class"><SelectValue>{sections.find((s) => s.id === current)?.label}</SelectValue></SelectTrigger>
          <SelectContent className="max-h-72">{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {r && <p className="text-sm text-muted-foreground">Class average <span className="font-semibold text-foreground tabular">{r.average_percent ?? "—"}%</span> · pass rate <span className="font-semibold text-foreground tabular">{r.pass_rate ?? "—"}%</span></p>}
        {current && <Link href={`/exams/${exam.id}/co-scholastic/${current}`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}>Co-scholastic grades</Link>}
        <Button variant="outline" size="sm" className={current ? "" : "ml-auto"} onClick={csv} disabled={!r}><Download aria-hidden />CSV</Button>
      </div>
      {!r ? <Skeleton className="h-96 rounded-xl" /> : (
        <FadeIn key={current} className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[800px] text-sm">
            <caption className="sr-only">{r.exam_name} results for {r.section_label}</caption>
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Rank</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Student</th>
                {r.subjects.map((s) => <th key={s.subject_name} scope="col" className="px-2 py-2.5 text-right font-semibold">{s.subject_name}<span className="block font-normal">/{fmtMarks(r.students[0]?.subjects.find((x) => x.subject_name === s.subject_name)?.max_marks ?? null)}</span></th>)}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">%</th>
                <th scope="col" className="px-3 py-2.5 text-center font-semibold">Grade</th>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">Report card</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...r.students].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((s) => (
                <tr key={s.student_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-semibold tabular">{s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : s.rank ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{s.name}</span>
                    {!s.passed && s.percent !== null && <span className="ml-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">Needs support</span>}
                    {s.remark && <span className="block max-w-56 truncate text-xs text-muted-foreground" title={s.remark}>“{s.remark}”</span>}
                  </td>
                  {s.subjects.map((x) => (
                    <td key={x.subject_name} className={cn("px-2 py-2 text-right tabular", x.passed === false && "font-semibold text-destructive")}>
                      {x.absent ? "AB" : fmtMarks(x.marks)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular">{s.percent ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><GradeBadge grade={s.grade} /></td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {canRemark && <Button variant="ghost" size="icon" className="size-8" aria-label={`Remark for ${s.name}`} onClick={() => setRemarking(s)}><MessageSquareText aria-hidden /></Button>}
                    <Link href={`/exams/${exam.id}/report/${s.student_id}`} className={buttonVariants({ variant: "ghost", size: "icon", className: "size-8" })} aria-label={`Report card for ${s.name}`}><FileText aria-hidden /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="row" colSpan={2} className="px-3 py-2 text-left font-semibold">Class average · pass rate</th>
                {r.subjects.map((s) => <td key={s.subject_name} className="px-2 py-2 text-right tabular">{s.average ?? "—"}<span className="block">{s.pass_rate ?? "—"}%</span></td>)}
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </FadeIn>
      )}
      <RemarkDialog examId={exam.id} student={remarking} onClose={() => setRemarking(null)} />
    </>
  );
}

function ExamPage({ id }: { id: string }) {
  const can = useCan();
  const q = useExam(id);
  const qc = useQueryClient();
  const [tabParam, setTab] = useParam("tab");
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const e = q.data;
  const toggle = useMutation({
    mutationFn: () => api(`/exams/${id}/${e?.published_at ? "unpublish" : "publish"}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); setConfirm(false); toast.success(e?.published_at ? "Results hidden from families" : "Results published to families"); },
    onError: (err) => { setConfirm(false); toast.error(errorText(err, "Could not change")); },
  });
  const del = useMutation({
    mutationFn: () => api(`/exams/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); toast.success("Exam deleted"); router.push("/exams"); },
    onError: (err) => { setDeleting(false); toast.error(errorText(err, "Could not delete")); },
  });
  if (q.isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!e) return <EmptyState title="Exam not found" />;
  const fallback = can("exams.manage") ? (e.published_at ? "results" : "datesheet") : "marks";
  const tab = tabParam ?? fallback;
  const pct = e.marks_expected ? Math.round((e.marks_entered / e.marks_expected) * 100) : 0;
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{e.name}</h1><ExamStatusBadge status={e.status} /></div>
          <p className="mt-1 text-sm text-muted-foreground">
            {KIND[e.kind]} · {e.academic_year}
            {e.start_date && ` · ${format(parseISO(e.start_date), "d MMM")}${e.end_date ? ` – ${format(parseISO(e.end_date), "d MMM yyyy")}` : ""}`}
            {` · ${pct}% of marks entered`}
          </p>
        </div>
        {can("exams.manage") && (
          <div className="flex gap-2">
            {!e.marks_entered && <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)}><Trash2 aria-hidden />Delete</Button>}
            <Button variant={e.published_at ? "outline" : "default"} onClick={() => setConfirm(true)} disabled={!e.papers}>
              {e.published_at ? <><EyeOff aria-hidden />Unpublish</> : <><Eye aria-hidden />Publish results</>}
            </Button>
          </div>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v === fallback ? null : String(v))} className="mb-5">
        <TabsList>
          <TabsTrigger value="marks">Mark sheets</TabsTrigger>
          <TabsTrigger value="datesheet">Date sheet</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "marks" && <MarksTab exam={e} />}
      {tab === "datesheet" && <DateSheetTab exam={e} />}
      {tab === "results" && <ResultsTab exam={e} />}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} pending={toggle.isPending}
        title={e.published_at ? "Hide results from families?" : "Publish results?"}
        description={e.published_at ? "Parents and students will no longer see this exam's report cards. Marks can be edited again." : `Parents and students will see marks, grades and report cards. Marks are ${pct}% complete and will be locked.`}
        confirmLabel={e.published_at ? "Unpublish" : "Publish"} onConfirm={() => toggle.mutate()} />
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} destructive pending={del.isPending} title={`Delete ${e.name}?`}
        description="The date sheet is removed too. Exams with marks can't be deleted." confirmLabel="Delete" onConfirm={() => del.mutate()} />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PermissionGate permission="exams.view">
      <Link href="/exams" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Exams</Link>
      <Suspense><ExamPage id={id} /></Suspense>
    </PermissionGate>
  );
}
