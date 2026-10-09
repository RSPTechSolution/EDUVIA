"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { AttemptResult, AttemptView } from "@/lib/api/types";
import { useAttemptResult } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ResultView({ r }: { r: AttemptResult }) {
  return (
    <>
      <div className="mb-5 rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-bold">{r.title}</h1>
        <p className="mt-1 text-muted-foreground">{r.student_name}</p>
        {r.released ? (
          <p className="mt-3 text-3xl font-extrabold tabular">{r.score ?? 0} <span className="text-lg font-medium text-muted-foreground">of {r.max_marks}{r.percent != null ? ` · ${r.percent}%` : ""}</span></p>
        ) : <p className="mt-3 text-sm">Submitted. Your teacher will release the results.</p>}
        {r.needs_marking && <p className="mt-1 text-sm text-warning">Some short answers are still being marked.</p>}
      </div>
      <ol className="space-y-3">
        {r.questions.map((q, i) => {
          const right = q.awarded != null && q.awarded >= q.marks;
          return (
            <li key={q.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-2">
                {q.awarded == null ? <Clock className="mt-0.5 size-5 text-warning" aria-label="Being marked" /> : right ? <CheckCircle2 className="mt-0.5 size-5 text-success" aria-label="Correct" /> : <XCircle className="mt-0.5 size-5 text-destructive" aria-label="Not correct" />}
                <p className="flex-1 font-medium">{i + 1}. {q.text}</p>
                <span className="text-xs text-muted-foreground">{q.awarded ?? "–"} / {q.marks}</span>
              </div>
              {q.options.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((o) => {
                    const mine = Array.isArray(q.your_answer) && q.your_answer.includes(o.id);
                    const correct = q.correct?.includes(o.id);
                    return <li key={o.id} className={cn("rounded border px-3 py-1.5", correct && "border-success/50 bg-success/10", mine && !correct && "border-destructive/50 bg-destructive/5")}>{o.text}{mine ? " · your answer" : ""}</li>;
                  })}
                </ul>
              ) : <p className="mt-2 text-sm">Your answer: {typeof q.your_answer === "string" && q.your_answer ? q.your_answer : "—"}</p>}
              {q.explanation && <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Taking({ id }: { id: string }) {
  const qc = useQueryClient();
  const [paper, setPaper] = useState<AttemptView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({});
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    api<AttemptView>(`/online-tests/${id}/start`, { method: "POST" })
      .then(({ data }) => { setPaper(data); setAnswers(data.answers ?? {}); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not open the test"));
  }, [id]);

  const submit = useCallback(async () => {
    setSending(true);
    try {
      const { data } = await api<AttemptResult>(`/online-tests/${id}/submit`, { method: "POST", body: { answers } });
      setResult(data);
      qc.invalidateQueries({ queryKey: ["online-tests"] });
      toast.success("Test submitted");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not submit");
      if (e instanceof ApiError && e.code === "TEST_SUBMITTED") setError(e.message);
    } finally {
      setSending(false);
      setConfirm(false);
    }
  }, [id, answers, qc]);

  // Countdown; at zero the answers are submitted.
  useEffect(() => {
    if (!paper || result) return;
    const end = new Date(paper.deadline).getTime();
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); submit(); }
    }, 1000);
    return () => clearInterval(t);
  }, [paper, result, submit]);

  // Save answers every 15 seconds if anything changed.
  useEffect(() => {
    if (!paper || result) return;
    const t = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      api(`/online-tests/${id}/answers`, { method: "PUT", body: { answers } }).catch(() => { dirty.current = true; });
    }, 15000);
    return () => clearInterval(t);
  }, [paper, result, id, answers]);

  const set = (qid: string, v: string[] | string) => { dirty.current = true; setAnswers((a) => ({ ...a, [qid]: v })); };
  if (result) return <ResultView r={result} />;
  if (error) return <EmptyState className="rounded-2xl border bg-card" title={error} action={<Link href="/my-tests" className="text-primary underline">Back to tests</Link>} />;
  if (!paper) return <Skeleton className="h-96 rounded-xl" />;
  const done = paper.questions.filter((q) => { const a = answers[q.id]; return Array.isArray(a) ? a.length > 0 : Boolean(a); }).length;
  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{paper.title}</p><p className="text-xs text-muted-foreground">{done} of {paper.questions.length} answered</p></div>
        <span className={cn("flex items-center gap-1.5 font-mono text-lg font-bold tabular", left != null && left < 60 && "text-destructive")} role="timer" aria-live="off" aria-label="Time left">
          <Clock className="size-5" aria-hidden />{left == null ? "--:--" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}
        </span>
        <Button onClick={() => setConfirm(true)} loading={sending}><Send aria-hidden />Submit</Button>
      </div>
      {paper.instructions && <p className="mb-4 rounded-xl border bg-muted/30 p-3 text-sm">{paper.instructions}</p>}
      <ol className="space-y-4">
        {paper.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border bg-card p-4">
            <p className="font-medium whitespace-pre-line">{i + 1}. {q.text} <span className="text-xs font-normal text-muted-foreground">({q.marks} mark{q.marks === 1 ? "" : "s"})</span></p>
            {q.kind === "short" ? (
              <Textarea className="mt-3" rows={3} value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""} onChange={(e) => set(q.id, e.target.value)} aria-label={`Answer to question ${i + 1}`} maxLength={2000} />
            ) : (
              <div className="mt-3 grid gap-2" role={q.kind === "multiple" ? "group" : "radiogroup"} aria-label={`Question ${i + 1}`}>
                {q.options.map((o) => {
                  const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                  const on = cur.includes(o.id);
                  return (
                    <button key={o.id} type="button" role={q.kind === "multiple" ? "checkbox" : "radio"} aria-checked={on}
                      onClick={() => set(q.id, q.kind === "multiple" ? (on ? cur.filter((x) => x !== o.id) : [...cur, o.id]) : [o.id])}
                      className={cn("rounded-lg border px-4 py-2.5 text-left text-sm transition", on ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted")}>
                      {o.text}
                    </button>
                  );
                })}
                {q.kind === "multiple" && <p className="text-xs text-muted-foreground">Choose all that apply.</p>}
              </div>
            )}
          </li>
        ))}
      </ol>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} pending={sending} title="Submit the test?"
        description={done < paper.questions.length ? `${paper.questions.length - done} question(s) are unanswered. You can't change answers after submitting.` : "You can't change answers after submitting."}
        confirmLabel="Submit" onConfirm={submit} />
    </>
  );
}

function Page({ id }: { id: string }) {
  const student = useSearchParams().get("student");
  const r = useAttemptResult(id, student);
  return (
    <>
      <Link href="/my-tests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Online tests</Link>
      {student ? (r.data ? <ResultView r={r.data} /> : <Skeleton className="h-96 rounded-xl" />) : <Taking id={id} />}
    </>
  );
}

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><Page id={id} /></Suspense>;
}
