"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Banknote, CheckCircle2, CreditCard, FlaskConical, Landmark, Loader2, QrCode, ReceiptText, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api/client";
import type { FeePayment, InvoiceRow, PaymentOrder } from "@/lib/api/types";
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
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.1 }}
                className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/12">
                <CheckCircle2 className="size-9 text-success" aria-hidden />
              </motion.div>
              <DialogTitle className="mt-4">{inr(done.amount)} received</DialogTitle>
              <DialogDescription className="mt-1">Receipt {done.receipt_no} · {invoice.student_name}</DialogDescription>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                <Link href={`/fees/receipts/${done.id}`} className={buttonVariants()}><ReceiptText aria-hidden />View receipt</Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }}>
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
            </motion.div>
          )}
        </AnimatePresence>
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

/** Parent-facing payment. In test mode the "gateway" is this dialog; no money moves. */
export function PayOnlineDialog({ invoice, open, onOpenChange }: { invoice: Pick<InvoiceRow, "id" | "invoice_no" | "balance" | "term" | "student_name"> | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; payment?: FeePayment } | null>(null);
  const start = useMutation({
    mutationFn: () => api<PaymentOrder>(`/fees/invoices/${invoice!.id}/pay`, { method: "POST" }),
    onSuccess: ({ data }) => setOrder(data),
    onError: (e) => { toast.error(errorText(e, "Could not start the payment")); onOpenChange(false); },
  });
  const confirm = useMutation({
    mutationFn: (outcome: "success" | "failure") => api<{ status: string; message: string; payment: FeePayment | null }>(`/fees/orders/${order!.order_id}/confirm`, { method: "POST", body: { outcome } }),
    onSuccess: ({ data }) => { setResult({ ok: data.status === "paid", message: data.message, payment: data.payment ?? undefined }); qc.invalidateQueries({ queryKey: ["fees"] }); },
    onError: (e) => setResult({ ok: false, message: errorText(e, "The payment could not be completed") }),
  });
  useEffect(() => {
    if (open && invoice) { setOrder(null); setResult(null); start.mutate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 240, damping: 14 }}
                className={cn("mx-auto flex size-16 items-center justify-center rounded-full", result.ok ? "bg-success/12" : "bg-destructive/10")}>
                {result.ok ? <CheckCircle2 className="size-9 text-success" aria-hidden /> : <XCircle className="size-9 text-destructive" aria-hidden />}
              </motion.div>
              <DialogTitle className="mt-4">{result.ok ? `${inr(result.payment!.amount)} paid` : "Payment failed"}</DialogTitle>
              <DialogDescription className="mt-1">{result.message}{result.payment && ` Receipt ${result.payment.receipt_no}.`}</DialogDescription>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                {result.payment && <Link href={`/fees/receipts/${result.payment.id}`} className={buttonVariants()}><ReceiptText aria-hidden />Receipt</Link>}
              </div>
            </motion.div>
          ) : (
            <motion.div key="pay" exit={{ opacity: 0 }}>
              <DialogHeader>
                <DialogTitle>Pay fees</DialogTitle>
                <DialogDescription>{invoice?.student_name} · {invoice?.term}</DialogDescription>
              </DialogHeader>
              {!order ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Starting secure payment…</div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-primary to-[oklch(0.5_0.13_220)] p-5 text-white shadow-lg">
                    <p className="text-xs opacity-80">Amount to pay</p>
                    <p className="mt-1 font-heading text-3xl font-extrabold tabular">{inr(order.amount)}</p>
                    <p className="mt-2 text-xs opacity-80">Invoice {order.invoice_no}</p>
                  </div>
                  {order.test_mode && (
                    <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/10 p-3 text-xs text-warning">
                      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Test mode: no real money moves. Choose what the bank would say.
                    </p>
                  )}
                  <div className="grid gap-2">
                    <Button size="lg" className="h-11" onClick={() => confirm.mutate("success")} loading={confirm.isPending} loadingText="Processing…">
                      <ShieldCheck aria-hidden />Pay {inr(order.amount)}
                    </Button>
                    {order.test_mode && <Button variant="ghost" size="sm" onClick={() => confirm.mutate("failure")} disabled={confirm.isPending}>Simulate a declined payment</Button>}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
