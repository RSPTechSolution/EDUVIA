"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { CalendarOff, Check, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useCan, useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { LeaveRequest } from "@/lib/api/types";
import { timeAgo } from "@/lib/format";
import { useLeave, useMyAttendance } from "@/lib/queries";
import { cn } from "@/lib/utils";

const KINDS: Record<string, string> = { sick: "Unwell", family: "Family function", travel: "Travel", other: "Other" };
const STATUS: Record<LeaveRequest["status"], string> = {
  pending: "bg-warning/10 text-warning", approved: "bg-success/10 text-success", rejected: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground",
};
const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);

function range(r: LeaveRequest) {
  const a = parseISO(r.from_date), b = parseISO(r.to_date);
  return r.from_date === r.to_date ? format(a, "EEE d MMM") : `${format(a, "d MMM")} – ${format(b, "d MMM")}`;
}

function RequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const kids = useMyAttendance(format(new Date(), "yyyy-MM"), open);
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [f, setF] = useState({ student_id: "", from_date: tomorrow, to_date: tomorrow, kind: "sick", reason: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF((x) => ({ ...x, reason: "" })); } }, [open]);
  useEffect(() => { if (kids.data?.length && !f.student_id) setF((x) => ({ ...x, student_id: kids.data![0].student_id })); }, [kids.data, f.student_id]);
  const save = useMutation({
    mutationFn: () => api("/leave", { method: "POST", body: f }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave"] }); toast.success("Leave requested. The class teacher has been told."); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not send the request")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Ask for leave</DialogTitle><DialogDescription>When the class teacher approves, those days show as leave, not absent.</DialogDescription></DialogHeader>
        <form id="leave-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {(kids.data?.length ?? 0) > 1 && (
            <Field label="Child" className="sm:col-span-2">
              {(a) => (
                <Select value={f.student_id} onValueChange={(v) => setF((x) => ({ ...x, student_id: String(v) }))}>
                  <SelectTrigger id={a.id} className="w-full"><SelectValue>{kids.data?.find((k) => k.student_id === f.student_id)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{kids.data?.map((k) => <SelectItem key={k.student_id} value={k.student_id}>{k.name} · {k.class_section}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Field>
          )}
          <Field label="From" required>{(a) => <Input {...a} type="date" value={f.from_date} onChange={(e) => setF((x) => ({ ...x, from_date: e.target.value, to_date: x.to_date < e.target.value ? e.target.value : x.to_date }))} />}</Field>
          <Field label="To" required>{(a) => <Input {...a} type="date" value={f.to_date} min={f.from_date} onChange={(e) => setF((x) => ({ ...x, to_date: e.target.value }))} />}</Field>
          <Field label="Why" className="sm:col-span-2">
            {(a) => (
              <Select value={f.kind} onValueChange={(v) => setF((x) => ({ ...x, kind: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{KINDS[f.kind]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Message to the teacher" required className="sm:col-span-2">{(a) => <Textarea {...a} rows={3} value={f.reason} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} maxLength={1000} placeholder="e.g. Fever since last night; doctor advised rest" />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="leave-form" disabled={!f.student_id || f.reason.trim().length < 3} loading={save.isPending} loadingText="Sending…">Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveCard({ r, family }: { r: LeaveRequest; family: boolean }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const done = () => qc.invalidateQueries({ queryKey: ["leave"] });
  const decide = useMutation({
    mutationFn: (approve: boolean) => api(`/leave/${r.id}/decide`, { method: "POST", body: { approve, note: note || null } }),
    onSuccess: (_, approve) => { done(); qc.invalidateQueries({ queryKey: ["attendance"] }); toast.success(approve ? `Approved. ${r.days} day(s) marked as leave.` : "Declined"); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/leave/${r.id}/cancel`, { method: "POST" }),
    onSuccess: () => { done(); toast.success("Request withdrawn"); },
    onError: (e) => toast.error(errText(e, "Could not withdraw")),
  });
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{family ? range(r) : r.student_name}</p>
        {!family && <span className="text-sm text-muted-foreground">{r.class_section}</span>}
        <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS[r.status])}>{r.status}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {family ? r.student_name : range(r)} · {r.days} school day{r.days === 1 ? "" : "s"} · {KINDS[r.kind] ?? r.kind}
      </p>
      <p className="mt-2 text-sm whitespace-pre-line">{r.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">Asked by {r.requested_by ?? "family"} · {timeAgo(r.requested_at)}</p>
      {r.decided_by && <p className="mt-1 text-xs text-muted-foreground">{r.status === "approved" ? "Approved" : r.status === "rejected" ? "Declined" : "Decided"} by {r.decided_by}{r.decision_note ? `: “${r.decision_note}”` : ""}</p>}
      {r.can_decide && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the family (optional)" aria-label={`Note about ${r.student_name}'s leave`} maxLength={300} />
          <div className="flex gap-2">
            <Button onClick={() => decide.mutate(true)} loading={decide.isPending && decide.variables}><Check aria-hidden />Approve</Button>
            <Button variant="outline" onClick={() => decide.mutate(false)} loading={decide.isPending && !decide.variables}><X aria-hidden />Decline</Button>
          </div>
        </div>
      )}
      {r.can_cancel && <Button variant="ghost" size="sm" className="mt-2" onClick={() => cancel.mutate()} loading={cancel.isPending}>Withdraw request</Button>}
    </li>
  );
}

export default function LeavePage() {
  const me = useSession();
  const can = useCan();
  const family = me.role === "parent" || me.role === "student";
  const [status, setStatus] = useState<string>(family ? "" : "pending");
  const q = useLeave(status || undefined);
  const [asking, setAsking] = useState(false);
  return (
    <>
      <PageHeader title={family ? "Leave" : "Leave requests"}
        description={family ? "Tell the school in advance when your child will be away." : can("attendance.manage") ? "Requests from families across the school." : "Requests for the class you teach."}
        actions={family && <Button onClick={() => setAsking(true)}><Plus aria-hidden />Ask for leave</Button>} />
      {!family && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {[["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Declined"], ["", "All"]].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}
              className={cn("rounded-full border px-3 py-1 text-sm transition", status === v ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{label}</button>
          ))}
        </div>
      )}
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<CalendarOff className="size-12 text-muted-foreground/60" aria-hidden />}
          title={family ? "No leave requests" : status === "pending" ? "Nothing waiting" : "No requests"}
          description={family ? "Ask ahead and the day won't count as absent." : undefined}
          action={family && <Button onClick={() => setAsking(true)}><Plus aria-hidden />Ask for leave</Button>} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">{q.data.map((r) => <LeaveCard key={r.id} r={r} family={family} />)}</ul>
      )}
      {family && <RequestDialog open={asking} onOpenChange={setAsking} />}
    </>
  );
}
