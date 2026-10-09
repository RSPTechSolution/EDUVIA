"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { BarChart3, Eye, EyeOff, FileQuestion, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { colorOf } from "@/components/timetable/grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { OnlineTest, Question, QuestionKind } from "@/lib/api/types";
import { useClasses, useHomeworkTargets, useOnlineTests, useQuestions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const KINDS: Record<QuestionKind, string> = { single: "One correct answer", multiple: "Several correct answers", true_false: "True or false", short: "Short answer" };
const STATUS: Record<OnlineTest["status"], string> = {
  draft: "bg-muted text-muted-foreground", upcoming: "bg-info/10 text-info", open: "bg-success/10 text-success", closed: "bg-primary/10 text-primary",
};
const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const local = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/** Class + subject pickers limited to what this teacher teaches. */
function useTeaching() {
  const targets = useHomeworkTargets();
  const classes = useClasses();
  return useMemo(() => {
    const out = new Map<string, { id: string; name: string; sections: { id: string; label: string }[]; subjects: Map<string, { id: string; name: string; color: string }> }>();
    for (const t of targets.data ?? []) {
      const c = classes.data?.find((x) => x.sections.some((s) => s.id === t.section_id));
      if (!c) continue;
      const entry = out.get(c.id) ?? { id: c.id, name: c.name, sections: [] as { id: string; label: string }[], subjects: new Map<string, { id: string; name: string; color: string }>() };
      entry.sections.push({ id: t.section_id, label: t.section_label });
      for (const s of t.subjects) entry.subjects.set(s.id, s);
      out.set(c.id, entry);
    }
    return [...out.values()];
  }, [targets.data, classes.data]);
}

function QuestionDialog({ classId, subjectId, question, open, onOpenChange }: { classId: string; subjectId: string; question: Question | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<QuestionKind>("single");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState<string[]>([]);
  const [shortAnswer, setShortAnswer] = useState("");
  const [marks, setMarks] = useState("1");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = ["a", "b", "c", "d", "e", "f"];
  useEffect(() => {
    if (!open) return;
    setKind(question?.kind ?? "single"); setText(question?.text ?? ""); setMarks(String(question?.marks ?? 1)); setExplanation(question?.explanation ?? "");
    setOptions(question && question.kind !== "true_false" && question.kind !== "short" ? question.options.map((o) => o.text) : ["", "", "", ""]);
    setAnswer(question && question.kind !== "short" ? question.answer : []); setShortAnswer(question?.kind === "short" ? question.answer.join("\n") : ""); setError(null);
  }, [open, question]);
  const save = useMutation({
    mutationFn: () => {
      const opts = options.map((t, i) => ({ id: ids[i], text: t.trim() })).filter((o) => o.text);
      const body = {
        class_id: classId, subject_id: subjectId, kind, text, marks: Number(marks), explanation: explanation || null,
        options: kind === "single" || kind === "multiple" ? opts : [],
        answer: kind === "short" ? shortAnswer.split("\n").map((x) => x.trim()).filter(Boolean) : answer,
      };
      return question ? api(`/questions/${question.id}`, { method: "PUT", body }) : api("/questions", { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["questions"] }); toast.success(question ? "Question saved" : "Question added"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const toggle = (id: string) => setAnswer((a) => (kind === "multiple" ? (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]) : [id]));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{question ? "Edit question" : "Add a question"}</DialogTitle><DialogDescription>Choice questions are marked automatically.</DialogDescription></DialogHeader>
        <form id="q-form" className="grid max-h-[62vh] gap-4 overflow-y-auto px-0.5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label="Type">
              {(a) => (
                <Select value={kind} onValueChange={(v) => { setKind(v as QuestionKind); setAnswer([]); }}>
                  <SelectTrigger id={a.id} className="w-full"><SelectValue>{KINDS[kind]}</SelectValue></SelectTrigger>
                  <SelectContent>{(Object.keys(KINDS) as QuestionKind[]).map((k) => <SelectItem key={k} value={k}>{KINDS[k]}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Marks">{(a) => <Input {...a} type="number" min={0.5} step={0.5} value={marks} onChange={(e) => setMarks(e.target.value)} />}</Field>
          </div>
          <Field label="Question" required>{(a) => <Textarea {...a} rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />}</Field>
          {(kind === "single" || kind === "multiple") && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Options <span className="font-normal text-muted-foreground">(tick the correct {kind === "multiple" ? "ones" : "one"})</span></legend>
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={answer.includes(ids[i])} onCheckedChange={() => toggle(ids[i])} aria-label={`Option ${ids[i].toUpperCase()} is correct`} disabled={!o.trim()} />
                  <Input value={o} onChange={(e) => setOptions((x) => x.map((v, j) => (j === i ? e.target.value : v)))} placeholder={`Option ${ids[i].toUpperCase()}`} aria-label={`Option ${ids[i].toUpperCase()}`} maxLength={500} />
                </div>
              ))}
              {options.length < 6 && <Button type="button" variant="ghost" size="sm" onClick={() => setOptions((x) => [...x, ""])}><Plus aria-hidden />Option</Button>}
            </fieldset>
          )}
          {kind === "true_false" && (
            <div className="flex gap-2" role="radiogroup" aria-label="Correct answer">
              {[["t", "True"], ["f", "False"]].map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={answer[0] === id} onClick={() => setAnswer([id])}
                  className={cn("rounded-lg border px-4 py-2 text-sm", answer[0] === id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>{label}</button>
              ))}
            </div>
          )}
          {kind === "short" && (
            <Field label="Accepted answers" hint="One per line. A matching answer gets full marks automatically; anything else you mark by hand.">
              {(a) => <Textarea {...a} rows={2} value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} />}
            </Field>
          )}
          <Field label="Explanation" hint="Shown with the result">{(a) => <Input {...a} value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={2000} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="q-form" disabled={!text.trim() || (kind !== "short" && !answer.length)} loading={save.isPending}>{question ? "Save" : "Add question"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Bank({ classId, subjectId }: { classId: string; subjectId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useQuestions(classId, subjectId, search || undefined);
  const [editing, setEditing] = useState<{ open: boolean; q: Question | null }>({ open: false, q: null });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["questions"] }); toast.success("Question removed"); },
    onError: (e) => toast.error(errText(e, "Could not remove")),
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions" aria-label="Search questions" className="h-9 w-64" />
        <Button className="ml-auto" onClick={() => setEditing({ open: true, q: null })}><Plus aria-hidden />Add question</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" title="No questions yet" description="Build a bank once and reuse it in many tests." /> : (
        <ol className="space-y-2">
          {q.data.map((x, i) => (
            <li key={x.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground tabular">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium whitespace-pre-line">{x.text}</p>
                  {x.options.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {x.options.map((o) => <li key={o.id} className={cn("rounded border px-2 py-0.5", x.answer.includes(o.id) && "border-success/50 bg-success/10 text-success")}>{o.text}</li>)}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{KINDS[x.kind]} · {x.marks} mark{x.marks === 1 ? "" : "s"}{x.used_in ? ` · in ${x.used_in} test(s)` : ""}</p>
                </div>
                {x.can_edit && <>
                  <Button variant="ghost" size="icon" aria-label="Edit question" onClick={() => setEditing({ open: true, q: x })}><Pencil aria-hidden /></Button>
                  <Button variant="ghost" size="icon" aria-label="Remove question" onClick={() => remove.mutate(x.id)}><Trash2 aria-hidden /></Button>
                </>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <QuestionDialog classId={classId} subjectId={subjectId} question={editing.q} open={editing.open} onOpenChange={(o) => setEditing((e) => ({ ...e, open: o }))} />
    </div>
  );
}

function TestDialog({ classId, subjectId, sections, open, onOpenChange }: { classId: string; subjectId: string; sections: { id: string; label: string }[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const bank = useQuestions(open ? classId : null, subjectId);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [secs, setSecs] = useState<string[]>([]);
  const [opens, setOpens] = useState(local(new Date()));
  const [closes, setCloses] = useState(local(addDays(new Date(), 2)));
  const [duration, setDuration] = useState("30");
  const [show, setShow] = useState("after_close");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setTitle(""); setPicked([]); setSecs(sections.map((s) => s.id)); setError(null); } }, [open, sections]);
  const save = useMutation({
    mutationFn: () => api("/online-tests", { method: "POST", body: {
      title, class_id: classId, subject_id: subjectId, section_ids: secs, question_ids: picked, duration_minutes: Number(duration), show_results: show,
      opens_at: new Date(opens).toISOString(), closes_at: new Date(closes).toISOString() } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["online-tests"] }); toast.success("Test saved as a draft. Publish it when ready."); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const total = (bank.data ?? []).filter((q) => picked.includes(q.id)).reduce((s, q) => s + q.marks, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>New online test</DialogTitle><DialogDescription>Pick questions from the bank. Students get the time limit from when they start.</DialogDescription></DialogHeader>
        <form id="t-form" className="grid max-h-[62vh] gap-4 overflow-y-auto px-0.5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Title" required className="sm:col-span-2">{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Fractions quiz" />}</Field>
          <Field label="Opens">{(a) => <Input {...a} type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />}</Field>
          <Field label="Closes">{(a) => <Input {...a} type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />}</Field>
          <Field label="Time limit (minutes)">{(a) => <Input {...a} type="number" min={1} max={300} value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          <Field label="Show results">
            {(a) => (
              <Select value={show} onValueChange={(v) => setShow(String(v))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{{ after_submit: "As soon as they submit", after_close: "After the test closes", never: "Don't show" }[show]}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="after_submit">As soon as they submit</SelectItem><SelectItem value="after_close">After the test closes</SelectItem><SelectItem value="never">Don&apos;t show</SelectItem></SelectContent>
              </Select>
            )}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Sections</legend>
            <div className="flex flex-wrap gap-3">{sections.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox checked={secs.includes(s.id)} onCheckedChange={(c) => setSecs((x) => (c ? [...x, s.id] : x.filter((y) => y !== s.id)))} />{s.label}</label>
            ))}</div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Questions <span className="font-normal text-muted-foreground">({picked.length} chosen · {total} marks)</span></legend>
            {!bank.data?.length ? <p className="text-sm text-muted-foreground">The bank is empty. Add questions first.</p> : (
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-lg border p-2">
                {bank.data.map((q) => (
                  <li key={q.id}>
                    <label className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40">
                      <Checkbox checked={picked.includes(q.id)} onCheckedChange={(c) => setPicked((x) => (c ? [...x, q.id] : x.filter((y) => y !== q.id)))} className="mt-0.5" />
                      <span className="flex-1">{q.text}</span><span className="text-xs text-muted-foreground">{q.marks}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="t-form" disabled={!title.trim() || !picked.length || !secs.length} loading={save.isPending}>Save test</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestsList() {
  const qc = useQueryClient();
  const q = useOnlineTests();
  const [removing, setRemoving] = useState<OnlineTest | null>(null);
  const pub = useMutation({
    mutationFn: (t: OnlineTest) => api(`/online-tests/${t.id}/publish`, { method: "POST", query: { on: !t.published } }),
    onSuccess: (_, t) => { qc.invalidateQueries({ queryKey: ["online-tests"] }); toast.success(t.published ? "Withdrawn" : "Published. Students and parents have been told."); },
    onError: (e) => toast.error(errText(e, "Could not change")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/online-tests/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["online-tests"] }); setRemoving(null); toast.success("Test deleted"); },
    onError: (e) => toast.error(errText(e, "Could not delete")),
  });
  if (q.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (!q.data?.length) return <EmptyState className="rounded-2xl border bg-card" illustration={<FileQuestion className="size-12 text-muted-foreground/60" aria-hidden />} title="No online tests yet" description="Choose a class and subject above, then create a test from the question bank." />;
  return (
    <ul className="grid gap-3 lg:grid-cols-2" aria-label="Tests">
      {q.data.map((t) => (
        <li key={t.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{t.title}</p>
            <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS[t.status])}>{t.status}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t.subject_name} · {t.sections_label} · {t.questions} questions, {t.max_marks} marks · {t.duration_minutes} min</p>
          <p className="text-xs text-muted-foreground">{format(parseISO(t.opens_at), "d MMM, h:mm a")} – {format(parseISO(t.closes_at), "d MMM, h:mm a")}</p>
          <p className="mt-1 text-xs">{t.submitted} submitted{t.average != null ? ` · average ${t.average}%` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/online-tests/${t.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}><BarChart3 aria-hidden />Results</Link>
            {t.can_edit && <Button size="sm" variant="outline" onClick={() => pub.mutate(t)} loading={pub.isPending && pub.variables?.id === t.id}>{t.published ? <><EyeOff aria-hidden />Withdraw</> : <><Eye aria-hidden />Publish</>}</Button>}
            {t.can_edit && t.attempts === 0 && <Button size="sm" variant="ghost" onClick={() => setRemoving(t)} aria-label={`Delete ${t.title}`}><Trash2 aria-hidden /></Button>}
          </div>
        </li>
      ))}
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Delete “${removing?.title}”?`} description="The questions stay in the bank." confirmLabel="Delete" onConfirm={() => removing && remove.mutate(removing.id)} />
    </ul>
  );
}

function OnlineTestsPage() {
  const teaching = useTeaching();
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [tab, setTab] = useState<"tests" | "bank">("tests");
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (!classId && teaching.length) { setClassId(teaching[0].id); setSubjectId([...teaching[0].subjects.keys()][0] ?? null); } }, [teaching, classId]);
  const current = teaching.find((c) => c.id === classId);
  return (
    <>
      <PageHeader title="Online tests" description="Quizzes students take on the app or website, marked automatically."
        actions={current && subjectId && <Button onClick={() => setCreating(true)}><Plus aria-hidden />New test</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Class" className="w-48">
          {(a) => (
            <Select value={classId ?? undefined} onValueChange={(v) => { const c = teaching.find((x) => x.id === v); setClassId(String(v)); setSubjectId(c ? [...c.subjects.keys()][0] ?? null : null); }}>
              <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Class">{current?.name}</SelectValue></SelectTrigger>
              <SelectContent className="max-h-72">{teaching.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subject">
          {current && [...current.subjects.values()].map((s) => (
            <button key={s.id} type="button" aria-pressed={subjectId === s.id} onClick={() => setSubjectId(s.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", subjectId === s.id ? colorOf(s.color).cell : "text-muted-foreground hover:bg-muted")}>{s.name}</button>
          ))}
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "tests" | "bank")} className="mb-4">
        <TabsList><TabsTrigger value="tests"><ListChecks aria-hidden />Tests</TabsTrigger><TabsTrigger value="bank"><FileQuestion aria-hidden />Question bank</TabsTrigger></TabsList>
      </Tabs>
      {tab === "tests" ? <TestsList /> : classId && subjectId ? <Bank classId={classId} subjectId={subjectId} /> : <EmptyState title="Choose a class and subject" />}
      {current && subjectId && <TestDialog classId={current.id} subjectId={subjectId} sections={current.sections} open={creating} onOpenChange={setCreating} />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="tests.manage"><OnlineTestsPage /></PermissionGate>;
}
