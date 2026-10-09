"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, ClipboardPen, Eye, EyeOff, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { BarList } from "@/components/dashboard/charts";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { Survey, SurveyQuestion, SurveyQuestionKind } from "@/lib/api/types";
import { useSurveyResults, useSurveys } from "@/lib/queries";
import { cn } from "@/lib/utils";

const KINDS: Record<SurveyQuestionKind, string> = { choice: "One choice", multi: "Several choices", rating: "Rating 1–5", text: "Written answer" };
const AUDIENCES: Record<string, string> = { everyone: "Everyone", families: "Parents and students", staff: "Staff" };
const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
let seq = 0;
const blankQ = (): SurveyQuestion => ({ id: `q${Date.now().toString(36)}${seq++}`, kind: "choice", text: "", options: ["", ""], required: true });

function Builder({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("families");
  const [anonymous, setAnonymous] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([blankQ()]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setTitle(""); setDescription(""); setAudience("families"); setAnonymous(false); setQuestions([blankQ()]); setError(null); } }, [open]);
  const upd = (i: number, patch: Partial<SurveyQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const save = useMutation({
    mutationFn: () => api("/surveys", { method: "POST", body: {
      title, description: description || null, audience, anonymous,
      questions: questions.map((q) => ({ ...q, options: q.kind === "choice" || q.kind === "multi" ? q.options.map((o) => o.trim()).filter(Boolean) : [] })) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surveys"] }); toast.success("Survey saved. Publish it to send it out."); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>New survey</DialogTitle><DialogDescription>Ask families or staff a few questions. Results are counted for you.</DialogDescription></DialogHeader>
        <form id="sv-form" className="max-h-[62vh] space-y-4 overflow-y-auto px-0.5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" required className="sm:col-span-2">{(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Annual day feedback" />}</Field>
            <Field label="Introduction" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
            <Field label="Who answers">
              {(a) => (
                <Select value={audience} onValueChange={(v) => setAudience(String(v))}>
                  <SelectTrigger id={a.id} className="w-full"><SelectValue>{AUDIENCES[audience]}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(AUDIENCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Field>
            <label className="flex items-center gap-3 self-end pb-2 text-sm"><Switch checked={anonymous} onCheckedChange={setAnonymous} />Hide names in results</label>
          </div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Question {i + 1}</span>
                  <Select value={q.kind} onValueChange={(v) => upd(i, { kind: v as SurveyQuestionKind })}>
                    <SelectTrigger className="h-8 w-40" aria-label={`Type of question ${i + 1}`}><SelectValue>{KINDS[q.kind]}</SelectValue></SelectTrigger>
                    <SelectContent>{(Object.keys(KINDS) as SurveyQuestionKind[]).map((k) => <SelectItem key={k} value={k}>{KINDS[k]}</SelectItem>)}</SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={q.required} onCheckedChange={(v) => upd(i, { required: Boolean(v) })} />Required</label>
                  {questions.length > 1 && <Button type="button" variant="ghost" size="icon" className="ml-auto" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>}
                </div>
                <Input className="mt-2" value={q.text} onChange={(e) => upd(i, { text: e.target.value })} placeholder="Your question" aria-label={`Question ${i + 1}`} maxLength={500} />
                {(q.kind === "choice" || q.kind === "multi") && (
                  <div className="mt-2 space-y-1.5">
                    {q.options.map((o, k) => (
                      <div key={k} className="flex gap-2">
                        <Input value={o} onChange={(e) => upd(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Option ${k + 1}`} aria-label={`Question ${i + 1} option ${k + 1}`} className="h-8" />
                        {q.options.length > 2 && <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Remove option" onClick={() => upd(i, { options: q.options.filter((_, j) => j !== k) })}><X aria-hidden /></Button>}
                      </div>
                    ))}
                    {q.options.length < 12 && <Button type="button" variant="ghost" size="sm" onClick={() => upd(i, { options: [...q.options, ""] })}><Plus aria-hidden />Option</Button>}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" onClick={() => setQuestions((qs) => [...qs, blankQ()])}><Plus aria-hidden />Add question</Button>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="sv-form" disabled={!title.trim() || questions.some((q) => !q.text.trim())} loading={save.isPending}>Save survey</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnswerDialog({ survey, onClose }: { survey: Survey | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setAnswers({}); setError(null); }, [survey]);
  const send = useMutation({
    mutationFn: () => api(`/surveys/${survey!.id}/respond`, { method: "POST", body: { answers } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surveys"] }); toast.success("Thank you for your answers"); onClose(); },
    onError: (e) => setError(errText(e, "Could not send")),
  });
  return (
    <Dialog open={Boolean(survey)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{survey?.title}</DialogTitle>{survey?.description && <DialogDescription>{survey.description}</DialogDescription>}</DialogHeader>
        <div className="max-h-[62vh] space-y-5 overflow-y-auto px-0.5">
          {survey?.questions.map((q, i) => (
            <fieldset key={q.id}>
              <legend className="mb-2 text-sm font-medium">{i + 1}. {q.text}{q.required && <span className="text-destructive" aria-hidden>*</span>}</legend>
              {q.kind === "text" && <Textarea rows={3} value={(answers[q.id] as string) ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} aria-label={q.text} maxLength={2000} />}
              {q.kind === "rating" && (
                <div className="flex gap-1" role="radiogroup" aria-label={q.text}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={answers[q.id] === n} aria-label={`${n} of 5`} onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}>
                      <Star className={cn("size-7", (answers[q.id] as number) >= n ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
                    </button>
                  ))}
                </div>
              )}
              {(q.kind === "choice" || q.kind === "multi") && (
                <div className="grid gap-1.5">
                  {q.options.map((o) => {
                    const cur = answers[q.id];
                    const on = q.kind === "choice" ? cur === o : Array.isArray(cur) && cur.includes(o);
                    return (
                      <button key={o} type="button" role={q.kind === "choice" ? "radio" : "checkbox"} aria-checked={on}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: q.kind === "choice" ? o : on ? (cur as string[]).filter((x) => x !== o) : [...((cur as string[]) ?? []), o] }))}
                        className={cn("rounded-lg border px-3 py-2 text-left text-sm", on ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted")}>{o}</button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => send.mutate()} loading={send.isPending}>Send answers</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useSurveyResults(id);
  const r = q.data;
  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{r?.survey.title ?? "Results"}</DialogTitle>
          <DialogDescription>{r ? `${r.responses} of ${r.audience_size} answered (${r.audience_size ? Math.round((r.responses * 100) / r.audience_size) : 0}%)` : ""}</DialogDescription></DialogHeader>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto">
          {!r ? <Skeleton className="h-40" /> : r.questions.map((x, i) => (
            <section key={x.id} aria-label={x.text}>
              <h3 className="mb-2 text-sm font-semibold">{i + 1}. {x.text} <span className="font-normal text-muted-foreground">({x.answers} answers{x.average != null ? ` · average ${x.average}/5` : ""})</span></h3>
              {x.kind === "text" ? (
                <ul className="space-y-1.5 text-sm">{x.texts.length ? x.texts.map((t, k) => <li key={k} className="rounded-lg bg-muted/50 px-3 py-2">“{t.text}”{t.by && <span className="text-xs text-muted-foreground"> · {t.by}</span>}</li>) : <li className="text-muted-foreground">No answers</li>}</ul>
              ) : <BarList items={Object.entries(x.counts).map(([label, value]) => ({ label: x.kind === "rating" ? `${label} star${label === "1" ? "" : "s"}` : label, value }))} />}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SurveysPage() {
  const can = useCan();
  const manage = can("surveys.manage");
  const qc = useQueryClient();
  const q = useSurveys();
  const [building, setBuilding] = useState(false);
  const [answering, setAnswering] = useState<Survey | null>(null);
  const [results, setResults] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Survey | null>(null);
  const pub = useMutation({
    mutationFn: (s: Survey) => api(`/surveys/${s.id}/publish`, { method: "POST", query: { on: !s.published } }),
    onSuccess: (_, s) => { qc.invalidateQueries({ queryKey: ["surveys"] }); toast.success(s.published ? "Survey closed to new answers" : "Survey sent out"); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/surveys/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surveys"] }); setRemoving(null); toast.success("Survey deleted"); },
  });
  return (
    <>
      <PageHeader title="Surveys" description={manage ? "Ask families or staff what they think, and see the answers counted." : "Questions from your school."}
        actions={manage && <Button onClick={() => setBuilding(true)}><Plus aria-hidden />New survey</Button>} />
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClipboardPen className="size-12 text-muted-foreground/60" aria-hidden />} title="No surveys" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((s) => (
            <li key={s.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{s.title}</p>
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", s.open ? "bg-success/10 text-success" : s.published ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning")}>
                  {s.open ? "Open" : s.published ? "Closed" : "Draft"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{s.audience_label} · {s.questions.length} questions{manage ? ` · ${s.responses} answers` : ""}</p>
              {s.description && <p className="mt-1 line-clamp-2 text-sm">{s.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {s.answered ? <span className="inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden />You answered</span>
                  : s.open && !manage && <Button size="sm" onClick={() => setAnswering(s)}>Answer</Button>}
                {manage && <Button size="sm" variant="outline" onClick={() => setResults(s.id)}><BarChart3 aria-hidden />Results</Button>}
                {manage && <Button size="sm" variant="outline" onClick={() => pub.mutate(s)}>{s.published ? <><EyeOff aria-hidden />Close</> : <><Eye aria-hidden />Publish</>}</Button>}
                {manage && <Button size="sm" variant="ghost" aria-label={`Delete ${s.title}`} onClick={() => setRemoving(s)}><Trash2 aria-hidden /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {manage && <Builder open={building} onOpenChange={setBuilding} />}
      <AnswerDialog survey={answering} onClose={() => setAnswering(null)} />
      <ResultsDialog id={results} onClose={() => setResults(null)} />
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Delete “${removing?.title}”?`} description="All answers are deleted too." confirmLabel="Delete" onConfirm={() => removing && remove.mutate(removing.id)} />
    </>
  );
}
