"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Hourglass, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import { useClasses, useFeeTerms } from "@/lib/queries";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);

/** Send fee reminders (notification + email) to families with dues. */
export function RemindersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const classes = useClasses(open);
  const terms = useFeeTerms();
  const [overdueOnly, setOverdueOnly] = useState(true);
  const [classId, setClassId] = useState("all");
  const [term, setTerm] = useState("all");
  useEffect(() => { if (open) { setOverdueOnly(true); setClassId("all"); setTerm("all"); } }, [open]);
  const send = useMutation({
    mutationFn: () => api<{ invoices: number; families: number; emails: number; skipped_recent: number }>("/fees/reminders", {
      method: "POST", body: { overdue_only: overdueOnly, class_id: classId === "all" ? null : classId, term: term === "all" ? null : term },
    }),
    onSuccess: ({ data }) => {
      onOpenChange(false);
      toast.success(data.invoices ? `Reminders sent for ${data.invoices} invoices` : "No one to remind",
        { description: `${data.families} family accounts notified · ${data.emails} emails${data.skipped_recent ? ` · ${data.skipped_recent} skipped (reminded in the last 3 days)` : ""}` });
    },
    onError: (e) => toast.error(errText(e, "Could not send reminders")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send fee reminders</DialogTitle>
          <DialogDescription>Families get an app notification and an email. Nobody is reminded twice within three days.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="flex items-center gap-3 text-sm"><Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} />Only overdue invoices</label>
          <Field label="Class">
            {(a) => (
              <Select value={classId} onValueChange={(v) => setClassId(String(v))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{classId === "all" ? "All classes" : classes.data?.find((c) => c.id === classId)?.name}</SelectValue></SelectTrigger>
                <SelectContent className="max-h-72"><SelectItem value="all">All classes</SelectItem>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Term">
            {(a) => (
              <Select value={term} onValueChange={(v) => setTerm(String(v))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{term === "all" ? "All terms" : term}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="all">All terms</SelectItem>{terms.data?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => send.mutate()} loading={send.isPending} loadingText="Sending…"><BellRing aria-hidden />Send reminders</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Rule { enabled: boolean; mode: "flat" | "per_day"; amount: number; grace_days: number; max_amount: number | null }

/** The school's late fee rule, and applying it to overdue invoices. */
export function LateFeeCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fees", "late-rule"], queryFn: async () => (await api<Rule>("/fees/late-fee-rule")).data });
  const [r, setR] = useState<Rule | null>(null);
  useEffect(() => { if (q.data) setR(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api<Rule>("/fees/late-fee-rule", { method: "PUT", body: r }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fees", "late-rule"] }); toast.success("Late fee rule saved"); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  const apply = useMutation({
    mutationFn: () => api<{ invoices: number; added: number }>("/fees/late-fees/apply", { method: "POST" }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      toast.success(data.invoices ? `Late fees added to ${data.invoices} invoices` : "Every overdue invoice is already up to date",
        data.invoices ? { description: `₹${data.added.toLocaleString("en-IN")} in total` } : undefined);
    },
    onError: (e) => toast.error(errText(e, "Could not apply")),
  });
  if (!r) return null;
  const set = (patch: Partial<Rule>) => setR((x) => (x ? { ...x, ...patch } : x));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Hourglass className="size-5 text-primary" aria-hidden />Late fee</CardTitle>
        <CardDescription>Added to unpaid invoices once they are overdue. It shows on the invoice as a separate line, and can be waived.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm"><Switch checked={r.enabled} onCheckedChange={(v) => set({ enabled: v })} />Charge a late fee</label>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Charged">
            {(a) => (
              <Select value={r.mode} onValueChange={(v) => set({ mode: v as Rule["mode"] })} disabled={!r.enabled}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{r.mode === "flat" ? "Once" : "Per day late"}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="flat">Once</SelectItem><SelectItem value="per_day">Per day late</SelectItem></SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Amount (₹)">{(a) => <Input {...a} type="number" min={0} value={r.amount} disabled={!r.enabled} onChange={(e) => set({ amount: Number(e.target.value) })} />}</Field>
          <Field label="Grace days">{(a) => <Input {...a} type="number" min={0} max={90} value={r.grace_days} disabled={!r.enabled} onChange={(e) => set({ grace_days: Number(e.target.value) })} />}</Field>
          <Field label="At most (₹)" hint="Empty for no cap">
            {(a) => <Input {...a} type="number" min={0} value={r.max_amount ?? ""} disabled={!r.enabled || r.mode === "flat"} onChange={(e) => set({ max_amount: e.target.value ? Number(e.target.value) : null })} />}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save.mutate()} loading={save.isPending}>Save rule</Button>
          <Button onClick={() => apply.mutate()} disabled={!q.data?.enabled} loading={apply.isPending} loadingText="Applying…"><Play aria-hidden />Apply to overdue invoices now</Button>
        </div>
      </CardContent>
    </Card>
  );
}
