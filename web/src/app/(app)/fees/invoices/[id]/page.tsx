"use client";

import { format, parseISO } from "date-fns";
import { ArrowLeft, BadgePercent, Phone, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { CollectDialog, DiscountDialog, InvoiceStatus, METHODS } from "@/components/fees/shared";
import { FadeIn } from "@/components/motion/primitives";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, inr } from "@/lib/format";
import { useInvoice } from "@/lib/queries";

function Detail({ id }: { id: string }) {
  const can = useCan();
  const q = useInvoice(id);
  const [collecting, setCollecting] = useState(false);
  const [discounting, setDiscounting] = useState(false);
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  const inv = q.data;
  if (!inv) return <EmptyState title="Invoice not found" />;
  const net = inv.total - inv.discount;
  const pct = net ? Math.min(100, (inv.paid / net) * 100) : 100;

  return (
    <>
      <FadeIn>
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{inv.student_name}</h1>
              <InvoiceStatus inv={inv} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/students/${inv.student_id}`} className="hover:text-primary hover:underline">{inv.class_section} · {inv.admission_no}</Link>
              {inv.guardian_phone && <> · <a href={`tel:${inv.guardian_phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="size-3" aria-hidden />{inv.guardian_phone}</a></>}
            </p>
            <p className="mt-3 text-sm"><span className="font-medium">{inv.term}</span> <span className="font-mono text-muted-foreground">{inv.invoice_no}</span></p>
            <p className="text-sm text-muted-foreground">Issued {format(parseISO(inv.issue_date), "d MMM yyyy")} · due {format(parseISO(inv.due_date), "d MMM yyyy")}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`font-heading text-3xl font-extrabold tabular ${inv.overdue ? "text-destructive" : ""}`}>{inr(inv.balance)}</p>
            <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-muted sm:ml-auto" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Paid">
              <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{inr(inv.paid)} of {inr(net)} paid</p>
            <div className="mt-4 flex gap-2 sm:justify-end">
              {can("fees.manage") && inv.status !== "paid" && <Button variant="outline" onClick={() => setDiscounting(true)}><BadgePercent aria-hidden />Concession</Button>}
              {can("fees.collect") && inv.balance > 0 && <Button onClick={() => setCollecting(true)}><Wallet aria-hidden />Collect payment</Button>}
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <caption className="sr-only">Charges on this invoice</caption>
              <tbody className="divide-y">
                {inv.items.map((i) => <tr key={i.name}><th scope="row" className="py-2 text-left font-normal">{i.name}</th><td className="py-2 text-right tabular">{inr(i.amount)}</td></tr>)}
                {inv.discount > 0 && <tr className="text-success"><th scope="row" className="py-2 text-left font-normal">Concession<span className="block text-xs opacity-80">{inv.discount_reason}</span></th><td className="py-2 text-right tabular">−{inr(inv.discount)}</td></tr>}
                <tr className="font-semibold"><th scope="row" className="pt-3 text-left">Total payable</th><td className="pt-3 text-right tabular">{inr(net)}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent>
            {inv.payments.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing paid yet.</p> : (
              <ol className="space-y-2">
                {inv.payments.map((p) => {
                  const M = METHODS[p.method] ?? METHODS.cash;
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success"><M.icon className="size-4" aria-hidden /></span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">{inr(p.amount)} · {M.label}{p.reference && <span className="font-mono text-xs text-muted-foreground"> {p.reference}</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">{formatDateTime(p.paid_at)} · {p.collected_by ?? "—"}</p>
                      </div>
                      <Link href={`/fees/receipts/${p.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ReceiptText className="size-4" aria-hidden />{p.receipt_no}</Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
      {can("fees.collect") && <CollectDialog invoice={inv} open={collecting} onOpenChange={setCollecting} />}
      {can("fees.manage") && <DiscountDialog invoice={inv} open={discounting} onOpenChange={setDiscounting} />}
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PermissionGate permission="fees.view">
      <Link href="/fees?tab=invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Invoices</Link>
      <Detail id={id} />
    </PermissionGate>
  );
}
