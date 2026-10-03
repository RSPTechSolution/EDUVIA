"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarRange, FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { EXAM_STATUS, ExamStatusBadge, KIND } from "@/components/exams/shared";
import { ClassesIllustration } from "@/components/illustrations";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { Exam, ExamDetail } from "@/lib/api/types";
import { useExams } from "@/lib/queries";
import { cn } from "@/lib/utils";

function CreateExamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("term");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api<ExamDetail>("/exams", { method: "POST", body: { name, kind, start_date: start || null, end_date: end || null } }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success(`${data.name} created`, { description: "Next, set up the date sheet." });
      router.push(`/exams/${data.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not create the exam"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New exam</DialogTitle><DialogDescription>e.g. Unit Test 3, Annual Exam.</DialogDescription></DialogHeader>
        <form id="exam-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Field label="Name" required error={error ?? undefined} className="sm:col-span-2">{(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}</Field>
          <Field label="Type" className="sm:col-span-2">
            {(a) => (
              <Select value={kind} onValueChange={(v) => setKind(String(v))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{KIND[kind]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(KIND).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Starts">{(a) => <Input {...a} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="Ends">{(a) => <Input {...a} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="exam-form" disabled={name.trim().length < 2} loading={create.isPending} loadingText="Creating…">Create exam</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExamCard({ e }: { e: Exam }) {
  const pct = e.marks_expected ? Math.round((e.marks_entered / e.marks_expected) * 100) : 0;
  return (
    <Link href={`/exams/${e.id}`} className="card-lift group flex h-full flex-col rounded-2xl border bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold group-hover:text-primary">{e.name}</p>
          <p className="text-xs text-muted-foreground">{KIND[e.kind]} · {e.academic_year}</p>
        </div>
        <ExamStatusBadge status={e.status} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarRange className="size-4" aria-hidden />
        {e.start_date ? `${format(parseISO(e.start_date), "d MMM")}${e.end_date ? ` – ${format(parseISO(e.end_date), "d MMM yyyy")}` : ""}` : "Dates not set"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{e.classes} classes · {e.papers} papers</p>
      <div className="mt-auto pt-4">
        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Marks entered</span><span className="font-semibold tabular">{pct}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn("h-full rounded-full transition-[width] duration-700", e.status === "published" ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}

export default function ExamsPage() {
  const can = useCan();
  const exams = useExams();
  const [creating, setCreating] = useState(false);
  return (
    <PermissionGate permission="exams.view">
      <PageHeader title="Exams" description="Date sheets, marks entry, results and report cards."
        actions={can("exams.manage") && <Button onClick={() => setCreating(true)}><Plus aria-hidden />New exam</Button>} />
      {!exams.data ? <Skeleton className="h-60 rounded-2xl" /> : exams.data.length === 0 ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClassesIllustration />} title="No exams yet"
          description="Create an exam, add its date sheet, and teachers can start entering marks."
          action={can("exams.manage") && <Button onClick={() => setCreating(true)}><Plus aria-hidden />New exam</Button>} />
      ) : (
        <>
          <ul className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="What the statuses mean">
            {Object.values(EXAM_STATUS).map((s) => <li key={s.label} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", s.cls.split(" ")[0])} />{s.label}</li>)}
          </ul>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {exams.data.map((e) => <StaggerItem key={e.id}><ExamCard e={e} /></StaggerItem>)}
          </Stagger>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="size-4" aria-hidden />Teachers see the mark sheets for the subjects they teach.</p>
        </>
      )}
      <CreateExamDialog open={creating} onOpenChange={setCreating} />
    </PermissionGate>
  );
}
