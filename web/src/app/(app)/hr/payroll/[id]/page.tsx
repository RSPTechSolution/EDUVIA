"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Banknote, FileDown, Lock, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { Payslip } from "@/lib/api/types";
import { downloadFile } from "@/lib/download";
import { inr } from "@/lib/format";
import { usePayrollRun } from "@/lib/queries";
import { cn } from "@/lib/utils";

function AdjustDialog({ runId, slip, onClose }: { runId: string; slip: Payslip | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [bonus, setBonus] = useState("");
  const [recovery, setRecovery] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { setBonus(String(slip?.adjustments.Bonus ?? "")); setRecovery(String(slip?.adjustments["Advance recovery"] ? -slip.adjustments["Advance recovery"] : "")); setNote(slip?.note ?? ""); }, [slip]);
  const save = useMutation({
    mutationFn: () => api(`/hr/payroll/${runId}/payslips/${slip!.id}`, { method: "PUT", body: { adjustments: { Bonus: Number(bonus) || 0, "Advance recovery": -(Number(recovery) || 0) }, note: note || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr", "payroll"] }); toast.success("Payslip updated"); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  return (
    <Dialog open={Boolean(slip)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Adjust {slip?.full_name}</DialogTitle><DialogDescription>One-off additions or recoveries for this month only.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="Bonus or arrears (₹)">{(a) => <Input {...a} type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />}</Field>
          <Field label="Advance recovery (₹)">{(a) => <Input {...a} type="number" min={0} value={recovery} onChange={(e) => setRecovery(e.target.value)} />}</Field>
          <Field label="Note">{(a) => <Input {...a} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}</Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Run({ id }: { id: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const can = useCan();
  const q = usePayrollRun(id);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [confirm, setConfirm] = useState<"finalise" | "delete" | null>(null);
  const [paidOn, setPaidOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const done = () => qc.invalidateQueries({ queryKey: ["hr", "payroll"] });
  const finalise = useMutation({ mutationFn: () => api(`/hr/payroll/${id}/finalise`, { method: "POST" }), onSuccess: () => { done(); setConfirm(null); toast.success("Finalised. Staff can see their payslips."); } });
  const remove = useMutation({ mutationFn: () => api(`/hr/payroll/${id}`, { method: "DELETE" }), onSuccess: () => { done(); router.push("/hr?tab=payroll"); } });
  const paid = useMutation({ mutationFn: () => api(`/hr/payroll/${id}/paid`, { method: "POST", body: { paid_on: paidOn } }), onSuccess: () => { done(); toast.success("Marked as paid"); } });
  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  const r = q.data;
  if (!r) return <EmptyState title="Payroll not found" />;
  const manage = can("payroll.manage");
  return (
    <>
      <Link href="/hr?tab=payroll" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Payroll</Link>
      <PageHeader title={`Payroll · ${format(parseISO(`${r.month}-01`), "MMMM yyyy")}`} description={`${r.staff} staff · gross ${inr(r.gross)} · net ${inr(r.net)} · ${r.status}`}
        actions={<>
          <Button variant="outline" onClick={() => downloadFile(`/hr/payroll/${id}/bank-advice.csv`, "bank-advice.csv").catch((e) => toast.error(e.message))}><FileDown aria-hidden />Bank advice</Button>
          {manage && r.status === "draft" && <Button variant="ghost" onClick={() => setConfirm("delete")} aria-label="Delete draft"><Trash2 aria-hidden /></Button>}
          {manage && r.status === "draft" && <Button onClick={() => setConfirm("finalise")}><Lock aria-hidden />Finalise</Button>}
        </>} />
      {manage && r.status === "finalised" && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <Field label="Salaries paid on">{(a) => <Input {...a} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="w-44" />}</Field>
          <Button onClick={() => paid.mutate()} loading={paid.isPending}><Banknote aria-hidden />Mark as paid</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Payslips</caption>
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2">Staff</th><th scope="col" className="px-2 py-2 text-right">Paid days</th><th scope="col" className="px-2 py-2 text-right">Gross</th>
            <th scope="col" className="px-2 py-2 text-right">Deductions</th><th scope="col" className="px-2 py-2 text-right">Net</th><th scope="col"><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {r.payslips.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2"><span className="font-medium">{s.full_name}</span><span className="block text-xs text-muted-foreground">{s.employee_id ?? "—"}{!s.bank_ready && <span className="text-warning"> · no bank details</span>}{s.note && ` · ${s.note}`}</span></td>
                <td className={cn("px-2 py-2 text-right tabular", s.lop_days > 0 && "text-warning")}>{s.paid_days}/{s.days_in_month}</td>
                <td className="px-2 py-2 text-right tabular">{inr(s.gross)}</td>
                <td className="px-2 py-2 text-right tabular">{inr(s.total_deductions)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular">{inr(s.net)}</td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" render={<a href={`/api/proxy/hr/payslips/${s.id}/pdf`} target="_blank" rel="noreferrer" />}>Payslip</Button>
                  {manage && r.status === "draft" && <Button variant="ghost" size="icon" aria-label={`Adjust ${s.full_name}`} onClick={() => setEditing(s)}><Pencil aria-hidden /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdjustDialog runId={id} slip={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={confirm === "finalise"} onOpenChange={(o) => !o && setConfirm(null)} pending={finalise.isPending} title="Finalise payroll?"
        description="Payslips are locked and staff are told they can see them." confirmLabel="Finalise" onConfirm={() => finalise.mutate()} />
      <ConfirmDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)} destructive pending={remove.isPending} title="Delete this draft?"
        description="You can run payroll for the month again." confirmLabel="Delete" onConfirm={() => remove.mutate()} />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PermissionGate permission="payroll.view"><Run id={id} /></PermissionGate>;
}
