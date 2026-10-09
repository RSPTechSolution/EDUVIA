"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import { inr } from "@/lib/format";
import { useLeaveTypes, useMyLeaveBalance, useMyPayslips, useStaffLeave } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ApplyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const types = useLeaveTypes();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [f, setF] = useState({ leave_type_id: "", from_date: tomorrow, to_date: tomorrow, reason: "", half_day: false });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setError(null); setF((x) => ({ ...x, reason: "", leave_type_id: x.leave_type_id || types.data?.[0]?.id || "" })); } }, [open, types.data]);
  const save = useMutation({
    mutationFn: () => api("/hr/leave", { method: "POST", body: { ...f, to_date: f.half_day ? f.from_date : f.to_date } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr"] }); toast.success("Leave applied. HR has been told."); onOpenChange(false); },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not apply"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Apply for leave</DialogTitle><DialogDescription>School holidays aren&apos;t counted.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Type">
            {(a) => (
              <Select value={f.leave_type_id || undefined} onValueChange={(v) => setF((x) => ({ ...x, leave_type_id: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Choose">{types.data?.find((t) => t.id === f.leave_type_id)?.name}</SelectValue></SelectTrigger>
                <SelectContent>{types.data?.filter((t) => t.is_active).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.half_day} onCheckedChange={(v) => setF((x) => ({ ...x, half_day: v }))} />Half day</label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">{(a) => <Input {...a} type="date" value={f.from_date} onChange={(e) => setF((x) => ({ ...x, from_date: e.target.value, to_date: x.to_date < e.target.value ? e.target.value : x.to_date }))} />}</Field>
            {!f.half_day && <Field label="To">{(a) => <Input {...a} type="date" value={f.to_date} min={f.from_date} onChange={(e) => setF((x) => ({ ...x, to_date: e.target.value }))} />}</Field>}
          </div>
          <Field label="Reason">{(a) => <Textarea {...a} rows={3} value={f.reason} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} maxLength={1000} />}</Field>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!f.leave_type_id || f.reason.trim().length < 3} loading={save.isPending}>Apply</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyHrPage() {
  const qc = useQueryClient();
  const balance = useMyLeaveBalance();
  const leave = useStaffLeave(true);
  const slips = useMyPayslips();
  const [applying, setApplying] = useState(false);
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/hr/leave/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr"] }); toast.success("Leave withdrawn"); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not withdraw"),
  });
  return (
    <>
      <PageHeader title="My leave and pay" description="Your leave balance and requests, and your payslips." actions={<Button onClick={() => setApplying(true)}><Plus aria-hidden />Apply for leave</Button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {balance.isLoading ? <Skeleton className="h-20" /> : balance.data?.map((b) => (
          <div key={b.id} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{b.name}</p>
            <p className="text-2xl font-bold tabular">{b.left ?? b.used}<span className="text-sm font-normal text-muted-foreground">{b.paid ? ` of ${b.allowed} left` : " taken"}</span></p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leave requests</CardTitle></CardHeader>
          <CardContent>
            {!leave.data?.length ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <ul className="divide-y text-sm">
                {leave.data.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{l.code}</span>
                    <span>{format(parseISO(l.from_date), "d MMM")}{l.to_date !== l.from_date ? ` – ${format(parseISO(l.to_date), "d MMM")}` : ""} · {l.days} day{l.days === 1 ? "" : "s"}</span>
                    <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold capitalize", l.status === "approved" ? "bg-success/10 text-success" : l.status === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>{l.status}</span>
                    {l.can_cancel && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => cancel.mutate(l.id)}>Withdraw</Button>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payslips</CardTitle></CardHeader>
          <CardContent>
            {slips.isLoading ? <Skeleton className="h-24" /> : !slips.data?.length ? <EmptyState className="py-6" title="No payslips yet" /> : (
              <ul className="divide-y text-sm">
                {slips.data.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2">
                    <span className="w-32 font-medium">{format(parseISO(`${s.month}-01`), "MMMM yyyy")}</span>
                    <span className="tabular">{inr(s.net)}</span>
                    <span className="text-xs text-muted-foreground">{s.paid_on ? `paid ${format(parseISO(s.paid_on), "d MMM")}` : s.status}</span>
                    <Button variant="ghost" size="sm" className="ml-auto" render={<a href={`/api/proxy/hr/payslips/${s.id}/pdf`} target="_blank" rel="noreferrer" />}><FileText aria-hidden />Open</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <ApplyDialog open={applying} onOpenChange={setApplying} />
    </>
  );
}
