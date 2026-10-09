"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarPlus, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useVisitors } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: string }> = {
  expected: { label: "Expected", tone: "bg-info/10 text-info" }, in: { label: "On campus", tone: "bg-success/10 text-success" },
  out: { label: "Left", tone: "bg-muted text-muted-foreground" }, cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
};

function Visitors() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const q = useVisitors(today, undefined, true);
  const [f, setF] = useState({ name: "", phone: "", purpose: "", expected_on: today, people: "1" });
  const invite = useMutation({
    mutationFn: () => api("/gate/visitors/invite", { method: "POST", body: { ...f, phone: f.phone.trim() || null, people: Number(f.people) || 1 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success("The gate has been told to expect them"); setF((x) => ({ ...x, name: "", phone: "", purpose: "" })); },
    onError: (e) => toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not save"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/gate/visitors/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success("Cancelled"); },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <>
      <PageHeader title="My visitors" description="Tell the gate who you're expecting, so they're let in without waiting. You're told when they arrive." />
      <form className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto_auto]" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
        <Field label="Name">{(a) => <Input {...a} value={f.name} onChange={set("name")} />}</Field>
        <Field label="Phone">{(a) => <Input {...a} type="tel" value={f.phone} onChange={set("phone")} />}</Field>
        <Field label="Purpose">{(a) => <Input {...a} value={f.purpose} onChange={set("purpose")} placeholder="e.g. Guest lecture" />}</Field>
        <Field label="Day">{(a) => <Input {...a} type="date" min={today} value={f.expected_on} onChange={set("expected_on")} className="w-40" />}</Field>
        <Field label="People">{(a) => <Input {...a} type="number" min={1} max={50} value={f.people} onChange={set("people")} className="w-20" />}</Field>
        <Button type="submit" className="self-end" disabled={f.name.trim().length < 2 || f.purpose.trim().length < 2} loading={invite.isPending}><CalendarPlus aria-hidden />Expect</Button>
      </form>
      {q.isLoading ? <Skeleton className="h-32 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<UserCheck className="size-12 text-muted-foreground/60" aria-hidden />} title="No visitors expected" />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {q.data.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{v.name}{v.people > 1 ? ` +${v.people - 1}` : ""}</p>
                <p className="text-sm text-muted-foreground">{v.purpose}{v.expected_on ? ` · ${formatDate(v.expected_on, "EEE d MMM")}` : ""}{v.in_at ? ` · arrived ${format(parseISO(v.in_at), "h:mm a")}` : ""}</p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[v.status].tone)}>{STATUS[v.status].label}</span>
              {v.can_cancel && <Button size="sm" variant="ghost" onClick={() => cancel.mutate(v.id)}>Cancel</Button>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="visitors.invite"><Visitors /></PermissionGate>;
}
