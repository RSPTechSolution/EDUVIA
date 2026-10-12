"use client";

import { format, parseISO } from "date-fns";
import { CalendarClock, CheckCircle2, ChevronDown, Landmark, ReceiptText, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion/motion";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { InvoiceStatus, METHODS } from "@/components/fees/shared";
import { FamilyIllustration } from "@/components/illustrations";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { useSession } from "@/components/session-provider";
import { Skeleton } from "@/components/ui/skeleton";
import type { InvoiceDetail } from "@/lib/api/types";
import { formatDateTime, inr } from "@/lib/format";
import { useMyFees } from "@/lib/queries";
import { cn } from "@/lib/utils";

function InvoiceCard({ inv }: { inv: InvoiceDetail }) {
  const [open, setOpen] = useState(inv.balance > 0);
  const net = inv.total - inv.discount;
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md", inv.overdue && "border-destructive/40")}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left outline-none focus-visible:bg-muted/50">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", inv.balance > 0 ? "bg-primary/10 text-primary" : "bg-success/12 text-success")}>
          {inv.balance > 0 ? <CalendarClock className="size-5" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{inv.term}</span>
          <span className="block text-xs text-muted-foreground">Due {format(parseISO(inv.due_date), "d MMM yyyy")} · {inv.invoice_no}</span>
        </span>
        <span className="text-right">
          <span className="block font-heading text-lg font-bold tabular">{inr(inv.balance > 0 ? inv.balance : net)}</span>
          <InvoiceStatus inv={inv} />
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
              <table className="w-full text-sm">
                <caption className="sr-only">Charges</caption>
                <tbody>
                  {inv.items.map((i) => <tr key={i.name}><td className="py-1 text-muted-foreground">{i.name}</td><td className="py-1 text-right tabular">{inr(i.amount)}</td></tr>)}
                  {inv.discount > 0 && <tr className="text-success"><td className="py-1">{inv.discount_reason ?? "Concession"}</td><td className="py-1 text-right tabular">−{inr(inv.discount)}</td></tr>}
                  <tr className="border-t font-semibold"><td className="pt-2">Total</td><td className="pt-2 text-right tabular">{inr(net)}</td></tr>
                  {inv.paid > 0 && <tr><td className="py-1 text-muted-foreground">Paid</td><td className="py-1 text-right tabular">{inr(inv.paid)}</td></tr>}
                </tbody>
              </table>
              <div className="space-y-2">
                {inv.payments.map((p) => (
                  <Link key={p.id} href={`/fees/receipts/${p.id}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:border-primary/40 hover:bg-muted/40">
                    <ReceiptText className="size-4 text-primary" aria-hidden />
                    <span className="flex-1"><span className="font-medium">{inr(p.amount)}</span> <span className="text-muted-foreground">· {METHODS[p.method]?.label ?? p.method} · {formatDateTime(p.paid_at)}</span></span>
                  </Link>
                ))}
                {inv.balance > 0 && (
                  <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden />Pay {inr(inv.balance)} at the school office (cash, UPI, cheque or bank transfer). Your receipt appears here once it&apos;s recorded.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MyFeesPage() {
  const me = useSession();
  const q = useMyFees();
  const [index, setIndex] = useState(0);
  const data = q.data;
  const child = data?.children[Math.min(index, (data?.children.length ?? 1) - 1)];

  return (
    <>
      <PageHeader title="Fees" description={me.role === "parent" ? "Fees for your children and their receipts. Fees are paid at the school office." : "Your fees and receipts."} />
      {q.isLoading ? <Skeleton className="h-96 rounded-2xl" /> : !data || !child ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<FamilyIllustration />} title="Nothing to show yet" description="No student is linked to this account." />
      ) : (
        <>
          <FadeIn>
            <div className="aurora relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.23_0.055_264)] via-[oklch(0.28_0.065_263)] to-[oklch(0.34_0.07_258)] p-6 text-white shadow-lg">
              <p className="text-sm text-white/80">Total due{data.children.length > 1 ? " for all children" : ""}</p>
              <p className="mt-1 font-heading text-4xl font-extrabold tabular">{inr(data.total_due)}</p>
              <p className="mt-2 text-sm text-white/80">
                {data.total_due === 0 ? "All paid up. Thank you!" : data.children.some((c) => c.overdue > 0) ? `${inr(data.children.reduce((n, c) => n + c.overdue, 0))} is overdue.` : "Nothing overdue."}
              </p>
              <Wallet className="absolute -right-4 -bottom-6 size-36 text-white/10" aria-hidden />
            </div>
          </FadeIn>
          {data.children.length > 1 && (
            <div role="tablist" aria-label="Child" className="mb-5 flex flex-wrap gap-2">
              {data.children.map((c, i) => (
                <button key={c.student_id} role="tab" type="button" aria-selected={c.student_id === child.student_id} onClick={() => setIndex(i)}
                  className={cn("rounded-xl border px-4 py-2 text-left transition active:scale-[0.98]", c.student_id === child.student_id ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40")}>
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.due ? `${inr(c.due)} due` : "Paid up"}</span>
                </button>
              ))}
            </div>
          )}
          <Stagger key={child.student_id} className="space-y-3">
            {child.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            {child.invoices.map((inv) => (
              <StaggerItem key={inv.id}>
                <InvoiceCard inv={inv} />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </>
  );
}
