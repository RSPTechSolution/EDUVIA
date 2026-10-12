"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Banknote, CheckCircle2, CreditCard, Landmark, QrCode, ReceiptText, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api/client";
import type { FeePayment, InvoiceRow } from "@/lib/api/types";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const METHODS: Record<string, { label: string; icon: React.ElementType }> = {
  cash: { label: "Cash", icon: Banknote },
  upi: { label: "UPI", icon: QrCode },
  cheque: { label: "Cheque", icon: Landmark },
  card: { label: "Card", icon: CreditCard },
  bank_transfer: { label: "Bank transfer", icon: Landmark },
  online: { label: "Online", icon: Smartphone },
};

export function InvoiceStatus({ inv }: { inv: Pick<InvoiceRow, "status" | "overdue"> }) {
  const [label, cls] = inv.status === "paid" ? ["Paid", "bg-success/12 text-success"]
    : inv.overdue ? ["Overdue", "bg-destructive/10 text-destructive"]
    : inv.status === "partial" ? ["Part paid", "bg-warning/12 text-warning"]
    : inv.status === "cancelled" ? ["Cancelled", "bg-muted text-muted-foreground"]
    : ["Due", "bg-info/12 text-info"];
  const Icon = inv.status === "paid" ? CheckCircle2 : inv.overdue ? AlertCircle : null;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>{Icon && <Icon className="size-3" aria-hidden />}{label}</span>;
}

const errorText = (e: unknown, fallback: string) => e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : fallback;

/** Counter collection: cash, UPI, cheque, card or bank transfer. */
export function CollectDialog({ invoice, open, onOpenChange }: { invoice: Pick<InvoiceRow, "id" | "invoice_no" | "balance" | "student_name" | "term">; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<FeePayment | null>(null);
  // Reset only when the dialog opens: the invoice refetches after a payment, and resetting then
  // would hide the confirmation and invite a second collection.
  useEffect(() => {
    if (open) { setAmount(String(invoice.balance)); setMethod("cash"); setReference(""); setNote(""); setError(null); setDone(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const collect = useMutation({
    mutationFn: () => api<FeePayment>(`/fees/invoices/${invoice.id}/payments`, {
      method: "POST", body: { amount: Number(amount), method, reference: reference || null, note: note || null },
    }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["fees"] }); setDone(data); },
    onError: (e) => setError(errorText(e, "Could not record the payment")),
  });
  const needsRef = method === "cheque" || method === "bank_transfer";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="enter-pop py-4 text-center">
            <div
              className="pop-in mx-auto flex size-16 items-center justify-center rounded-full bg-success/12">
              <CheckCircle2 className="size-9 text-success" aria-hidden />
            </div>
            <DialogTitle className="mt-4">{inr(done.amount)} received</DialogTitle>
            <DialogDescription className="mt-1">Receipt {done.receipt_no} · {invoice.student_name}</DialogDescription>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Link href={`/fees/receipts/${done.id}`} className={buttonVariants()}><ReceiptText aria-hidden />View receipt</Link>
            </div>
          </div>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle>Collect payment</DialogTitle>
              <DialogDescription>{invoice.student_name} · {invoice.invoice_no} · {inr(invoice.balance)} due</DialogDescription>
            </DialogHeader>
            <form id="collect-form" className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); setError(null); collect.mutate(); }}>
              <Field label="Amount (₹)" required error={error ?? undefined}>
                {(a) => <Input {...a} type="number" inputMode="decimal" min={1} max={invoice.balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold tabular" />}
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Paid by</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {(["cash", "upi", "cheque", "card", "bank_transfer"] as const).map((m) => {
                    const M = METHODS[m];
                    return (
                      <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}
                        className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition active:scale-95",
                          method === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                        <M.icon className="size-4" aria-hidden />{M.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {method !== "cash" && (
                <Field label={method === "cheque" ? "Cheque number" : method === "upi" ? "UPI reference" : "Transaction reference"} required={needsRef}>
                  {(a) => <Input {...a} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className="font-mono" />}
                </Field>
              )}
              <Field label="Note">{(a) => <Input {...a} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Optional" />}</Field>
            </form>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" form="collect-form" disabled={!Number(amount) || (needsRef && !reference.trim())} loading={collect.isPending} loadingText="Recording…">
                Record {amount && Number(amount) > 0 ? inr(Number(amount)) : "payment"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DiscountDialog({ invoice, open, onOpenChange }: { invoice: { id: string; total: number; paid: number; discount: number; discount_reason: string | null }; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setAmount(String(invoice.discount || "")); setReason(invoice.discount_reason ?? ""); setError(null); }
  }, [open, invoice.discount, invoice.discount_reason]);
  const save = useMutation({
    mutationFn: () => api(`/fees/invoices/${invoice.id}/discount`, { method: "PUT", body: { amount: Number(amount || 0), reason } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fees"] }); onOpenChange(false); toast.success("Concession saved"); },
    onError: (e) => setError(errorText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Concession</DialogTitle><DialogDescription>Reduce what this family owes. The reason is kept in the audit log.</DialogDescription></DialogHeader>
        <form id="disc-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Amount (₹)" required error={error ?? undefined} hint={`At most ${inr(invoice.total - invoice.paid)}`}>
            {(a) => <Input {...a} type="number" min={0} max={invoice.total - invoice.paid} value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Reason" required>{(a) => <Input {...a} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sibling concession, staff ward" maxLength={200} />}</Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="disc-form" disabled={reason.trim().length < 3} loading={save.isPending} loadingText="Saving…">Save concession</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
