"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addHours, format, parseISO, startOfHour } from "date-fns";
import { Check, Plus, Ticket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StudentPicker } from "@/components/academics/pickers";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useCan, useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { GatePass } from "@/lib/api/types";
import { useGatePasses, useMyAttendance } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const TONE: Record<string, string> = {
  pending: "bg-warning/10 text-warning", approved: "bg-primary/10 text-primary", used: "bg-success/10 text-success", rejected: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground",
};
const LABEL: Record<string, string> = { pending: "Waiting for the teacher", approved: "Approved", used: "Left school", rejected: "Declined", cancelled: "Cancelled" };

function RequestDialog({ open, onOpenChange, office }: { open: boolean; onOpenChange: (o: boolean) => void; office: boolean }) {
  const qc = useQueryClient();
  const kids = useMyAttendance(format(new Date(), "yyyy-MM"), open && !office);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [f, setF] = useState({ reason: "", pickup_name: "", pickup_relation: "", pickup_phone: "", leave_at: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setError(null); setStudent(null); setF({ reason: "", pickup_name: "", pickup_relation: "", pickup_phone: "", leave_at: format(addHours(startOfHour(new Date()), 2), "yyyy-MM-dd'T'HH:mm") }); }
  }, [open]);
  useEffect(() => { if (!office && kids.data?.length && !student) setStudent({ id: kids.data[0].student_id, name: kids.data[0].name }); }, [kids.data, student, office]);
  const save = useMutation({
    mutationFn: () => api<GatePass>("/gate/passes", { method: "POST", body: {
      student_id: student!.id, reason: f.reason, pickup_name: f.pickup_name, pickup_relation: f.pickup_relation, pickup_phone: f.pickup_phone.trim() || null,
      leave_at: new Date(f.leave_at).toISOString(),
    } }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["gate"] });
      toast.success(data.status === "approved" ? `Pass ready. Code ${data.code} has been sent to the family.` : "Sent. You'll get the code once the class teacher approves.");
      onOpenChange(false);
    },
    onError: (e) => setError(errText(e, "Could not send")),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{office ? "Issue a gate pass" : "Early pickup"}</DialogTitle>
          <DialogDescription>{office ? "Issued by the office, so it's approved straight away." : "The person collecting shows a 6-digit code at the gate."}</DialogDescription>
        </DialogHeader>
        <form id="pass-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {office ? (
            <div className="sm:col-span-2">
              {student ? <p className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span className="font-medium">{student.name}</span><Button size="sm" variant="ghost" onClick={() => setStudent(null)}>Change</Button></p>
                : <StudentPicker onPick={(s) => setStudent({ id: s.id, name: s.name })} />}
            </div>
          ) : (kids.data?.length ?? 0) > 1 && (
            <Field label="Child" className="sm:col-span-2">
              {(a) => (
                <Select value={student?.id ?? ""} onValueChange={(v) => { const k = kids.data!.find((x) => x.student_id === v); if (k) setStudent({ id: k.student_id, name: k.name }); }}>
                  <SelectTrigger id={a.id} className="w-full"><SelectValue>{student?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{kids.data?.map((k) => <SelectItem key={k.student_id} value={k.student_id}>{k.name} · {k.class_section}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Field>
          )}
          <Field label="Leaving at" required>{(a) => <Input {...a} type="datetime-local" value={f.leave_at} onChange={set("leave_at")} />}</Field>
          <Field label="Reason" required>{(a) => <Input {...a} value={f.reason} onChange={set("reason")} placeholder="e.g. Doctor's appointment" />}</Field>
          <Field label="Collected by" required>{(a) => <Input {...a} value={f.pickup_name} onChange={set("pickup_name")} placeholder="Full name" />}</Field>
          <Field label="Relation" required>{(a) => <Input {...a} value={f.pickup_relation} onChange={set("pickup_relation")} placeholder="Mother, uncle, driver…" />}</Field>
          <Field label="Their phone" className="sm:col-span-2">{(a) => <Input {...a} type="tel" value={f.pickup_phone} onChange={set("pickup_phone")} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="pass-form" disabled={!student || f.reason.trim().length < 2 || f.pickup_name.trim().length < 2 || f.pickup_relation.trim().length < 2}
            loading={save.isPending}>{office ? "Issue pass" : "Send request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PassCard({ p }: { p: GatePass }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (what: "approve" | "decline" | "cancel") => what === "cancel"
      ? api<GatePass>(`/gate/passes/${p.id}/cancel`, { method: "POST" })
      : api<GatePass>(`/gate/passes/${p.id}/decide`, { method: "POST", body: { approve: what === "approve" } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success(data.status === "approved" ? "Approved. The family has the code." : data.status === "rejected" ? "Declined" : "Cancelled"); },
    onError: (e) => toast.error(errText(e, "Could not update")),
  });
  const at = parseISO(p.leave_at);
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{p.student_name}</p>
        <span className="text-sm text-muted-foreground">{p.class_section}</span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", TONE[p.status])}>{LABEL[p.status]}</span>
      </div>
      <p className="mt-1 text-sm">{format(at, "EEE d MMM, h:mm a")} · {p.pickup_name} ({p.pickup_relation})</p>
      <p className="text-sm text-muted-foreground">{p.reason}{p.decision_note ? ` · ${p.decision_note}` : ""}</p>
      {p.code && (
        <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">Code at the gate: <span className="font-mono text-xl font-bold tracking-[0.3em] text-primary">{p.code}</span></p>
      )}
      {p.used_at && <p className="mt-2 text-sm text-success">Left at {format(parseISO(p.used_at), "h:mm a")}{p.verified_by ? ` · checked by ${p.verified_by}` : ""}</p>}
      {(p.can_decide || p.can_cancel) && (
        <div className="mt-3 flex gap-2">
          {p.can_decide && <Button size="sm" onClick={() => act.mutate("approve")} loading={act.isPending && act.variables === "approve"}><Check aria-hidden />Approve</Button>}
          {p.can_decide && <Button size="sm" variant="outline" onClick={() => act.mutate("decline")}><X aria-hidden />Decline</Button>}
          {p.can_cancel && <Button size="sm" variant="ghost" onClick={() => act.mutate("cancel")}>Cancel pass</Button>}
        </div>
      )}
    </li>
  );
}

export default function GatePassPage() {
  const me = useSession();
  const can = useCan();
  const family = me.role === "parent" || me.role === "student";
  const office = can("gatepass.issue");
  const q = useGatePasses(null);
  const [open, setOpen] = useState(false);
  const pending = (q.data ?? []).filter((p) => p.status === "pending");
  const rest = (q.data ?? []).filter((p) => p.status !== "pending");
  return (
    <>
      <PageHeader title="Gate passes" description={family ? "Ask for your child to be collected early. You get a code to show at the gate." : "Early pickups: approve requests for your class, or issue a pass from the office."}
        actions={(family || office) && <Button onClick={() => setOpen(true)}><Plus aria-hidden />{family ? "Early pickup" : "Issue pass"}</Button>} />
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Ticket className="size-12 text-muted-foreground/60" aria-hidden />} title="No gate passes" />
      ) : (
        <>
          {pending.length > 0 && <><h2 className="mb-3 font-heading text-lg font-bold">Waiting</h2><ul className="mb-8 grid gap-3 lg:grid-cols-2">{pending.map((p) => <PassCard key={p.id} p={p} />)}</ul></>}
          {rest.length > 0 && <><h2 className="mb-3 font-heading text-lg font-bold">All passes</h2><ul className="grid gap-3 lg:grid-cols-2">{rest.map((p) => <PassCard key={p.id} p={p} />)}</ul></>}
        </>
      )}
      {(family || office) && <RequestDialog open={open} onOpenChange={setOpen} office={!family && office} />}
    </>
  );
}
