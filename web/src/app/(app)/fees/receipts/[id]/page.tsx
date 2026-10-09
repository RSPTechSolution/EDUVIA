"use client";

import { ArrowLeft, CheckCircle2, FileDown, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { BrandMark } from "@/components/brand/logo";
import { EmptyState } from "@/components/common/empty-state";
import { METHODS } from "@/components/fees/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime, inr } from "@/lib/format";
import { useReceipt } from "@/lib/queries";

/** A printable receipt. Staff, and the parent or student it belongs to, can open it. */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const q = useReceipt(id);
  if (q.isLoading) return <Skeleton className="mx-auto h-[640px] max-w-2xl rounded-2xl" />;
  const r = q.data;
  if (!r) return <EmptyState title="Receipt not found" />;
  const p = r.payment;
  const inv = r.invoice;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Back</button>
        <div className="flex gap-2">
          <Button variant="outline" render={<a href={`/api/proxy/fees/payments/${id}/receipt.pdf?download=true`} />}><FileDown aria-hidden />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer aria-hidden />Print</Button>
        </div>
      </div>
      <article className="relative overflow-hidden rounded-2xl border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:shadow-none" aria-label={`Receipt ${p.receipt_no}`}>
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-emerald-500/10" aria-hidden />
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <BrandMark size={44} tone="light" />
            <div>
              <p className="text-lg font-bold">{r.school_name}</p>
              {r.school_address && <p className="text-xs text-slate-500">{r.school_address}</p>}
              {r.school_phone && <p className="text-xs text-slate-500">{r.school_phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Fee receipt</p>
            <p className="font-mono text-lg font-bold">{p.receipt_no}</p>
            <p className="text-xs text-slate-500">{formatDateTime(p.paid_at)}</p>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 py-5 text-sm">
          <div><dt className="text-xs text-slate-500">Student</dt><dd className="font-semibold">{inv.student_name}</dd></div>
          <div><dt className="text-xs text-slate-500">Class</dt><dd>{inv.class_section}</dd></div>
          <div><dt className="text-xs text-slate-500">Admission no.</dt><dd className="font-mono">{inv.admission_no}</dd></div>
          <div><dt className="text-xs text-slate-500">Invoice</dt><dd>{inv.term} <span className="font-mono text-xs text-slate-500">{inv.invoice_no}</span></dd></div>
        </dl>
        <table className="w-full text-sm">
          <caption className="sr-only">Invoice charges</caption>
          <thead><tr className="border-y border-slate-200 text-xs text-slate-500"><th scope="col" className="py-2 text-left font-semibold">Charge</th><th scope="col" className="py-2 text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {inv.items.map((i) => <tr key={i.name} className="border-b border-slate-100"><td className="py-2">{i.name}</td><td className="py-2 text-right tabular-nums">{inr(i.amount)}</td></tr>)}
            {inv.discount > 0 && <tr className="border-b border-slate-100 text-emerald-700"><td className="py-2">Concession ({inv.discount_reason})</td><td className="py-2 text-right tabular-nums">−{inr(inv.discount)}</td></tr>}
            <tr className="font-semibold"><td className="py-2">Total payable</td><td className="py-2 text-right tabular-nums">{inr(inv.total - inv.discount)}</td></tr>
          </tbody>
        </table>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
            <div>
              <p className="text-xs text-emerald-800">Amount received · {METHODS[p.method]?.label ?? p.method}{p.reference && ` · ${p.reference}`}</p>
              <p className="text-2xl font-extrabold tabular-nums text-emerald-900">{inr(p.amount)}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-xs text-slate-500">Balance after this payment</p>
            <p className="font-semibold tabular-nums">{inr(r.balance_after)}</p>
          </div>
        </div>
        <footer className="mt-8 flex items-end justify-between text-xs text-slate-500">
          <p>{p.collected_by ? `Received by ${p.collected_by}` : ""}<br />Printed {formatDate(new Date())}</p>
          <p className="text-right">This is a computer-generated receipt<br />and needs no signature.</p>
        </footer>
      </article>
    </div>
  );
}
