"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BadgeIndianRupee, Check, Fingerprint, Pencil, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api/client";
import { formatDate, inr, roleLabel } from "@/lib/format";
import { usePayrollRuns, useStaffDay, useStaffDetail, useStaffDirectory, useStaffLeave } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const STATUSES = [["present", "Present"], ["absent", "Absent"], ["late", "Late"], ["half_day", "Half day"], ["leave", "Leave"]] as const;
const TONE: Record<string, string> = { present: "bg-success text-white", late: "bg-warning text-white", absent: "bg-destructive text-white", half_day: "bg-info text-white", leave: "bg-primary text-primary-foreground" };

function ProfileSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const can = useCan();
  const q = useStaffDetail(userId);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    if (q.data) setF(Object.fromEntries(Object.entries(q.data.profile).map(([k, v]) => [k, typeof v === "boolean" ? v : v == null ? "" : String(v)])));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(f)) body[k] = typeof v === "boolean" ? v : v === "" ? (["basic", "hra", "da", "conveyance", "special", "tds", "professional_tax"].includes(k) ? 0 : null) : v;
      return api(`/hr/staff/${userId}`, { method: "PUT", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr"] }); toast.success("Saved"); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const manage = can("hr.manage");
  const gross = ["basic", "hra", "da", "conveyance", "special"].reduce((s, k) => s + (Number(f[k]) || 0), 0);
  const text = (k: string, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label}>{(a) => <Input {...a} {...props} value={(f[k] as string) ?? ""} onChange={set(k)} disabled={!manage} />}</Field>
  );
  return (
    <Sheet open={Boolean(userId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>{q.data?.full_name ?? "Staff"}</SheetTitle><SheetDescription>{q.data ? `${roleLabel(q.data.role)}${q.data.designation ? ` · ${q.data.designation}` : ""} · ${q.data.email}` : ""}</SheetDescription></SheetHeader>
        {!q.data ? <Skeleton className="m-4 h-96" /> : (
          <div className="space-y-5 px-4 pb-4">
            <section className="grid gap-3 sm:grid-cols-2">
              {text("department", "Department")}
              {text("qualification", "Qualification")}
              {text("date_of_joining", "Date of joining", { type: "date" })}
              {text("date_of_birth", "Date of birth", { type: "date" })}
              {text("pan", "PAN")}
              {text("uan", "UAN (PF)")}
              {text("bank_name", "Bank")}
              {text("bank_account", "Account number", { inputMode: "numeric" })}
              {text("ifsc", "IFSC")}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Monthly salary <span className="font-normal text-muted-foreground">· gross {inr(gross)}</span></h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {text("basic", "Basic", { type: "number", min: 0 })}
                {text("hra", "HRA", { type: "number", min: 0 })}
                {text("da", "DA", { type: "number", min: 0 })}
                {text("conveyance", "Conveyance", { type: "number", min: 0 })}
                {text("special", "Special allowance", { type: "number", min: 0 })}
                {text("tds", "Income tax (TDS)", { type: "number", min: 0 })}
                {text("professional_tax", "Professional tax", { type: "number", min: 0 })}
              </div>
              <div className="mt-3 flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2"><Switch checked={Boolean(f.pf_enabled)} disabled={!manage} onCheckedChange={(v) => setF((x) => ({ ...x, pf_enabled: v }))} />Provident fund</label>
                <label className="flex items-center gap-2"><Switch checked={Boolean(f.esi_enabled)} disabled={!manage} onCheckedChange={(v) => setF((x) => ({ ...x, esi_enabled: v }))} />ESI (if eligible)</label>
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Leave this year</h3>
              <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                {q.data.leave_balance.map((b) => <li key={b.id} className="rounded-lg border px-3 py-2">{b.name}: <span className="font-semibold">{b.left ?? "—"}</span>{b.paid ? ` of ${b.allowed} left` : ` · ${b.used} taken`}</li>)}
              </ul>
            </section>
          </div>
        )}
        {manage && <SheetFooter><Button onClick={() => save.mutate()} loading={save.isPending}><Save aria-hidden />Save</Button></SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}

function StaffTab() {
  const q = useStaffDirectory();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => (q.data ?? []).filter((r) => !search || `${r.full_name} ${r.designation} ${r.department} ${r.employee_id}`.toLowerCase().includes(search.toLowerCase())), [q.data, search]);
  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <>
      <div className="relative mb-3 w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff" className="h-9 pl-9" aria-label="Search staff" />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Staff</caption>
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="px-4 py-2">Name</th><th scope="col" className="px-2 py-2">Role</th><th scope="col" className="px-2 py-2">Department</th><th scope="col" className="px-2 py-2">Joined</th><th scope="col" className="px-2 py-2 text-right">Monthly gross</th><th scope="col" className="px-2 py-2">Today</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2"><span className="font-medium">{r.full_name}</span><span className="block text-xs text-muted-foreground">{r.employee_id ?? "—"} · {r.designation ?? roleLabel(r.role)}</span></td>
                <td className="px-2 py-2">{roleLabel(r.role)}</td>
                <td className="px-2 py-2">{r.department ?? "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.date_of_joining)}</td>
                <td className="px-2 py-2 text-right tabular">{r.gross_monthly ? inr(r.gross_monthly) : <span className="text-warning">Not set</span>}{r.gross_monthly > 0 && !r.has_bank && <span className="block text-xs text-warning">No bank details</span>}</td>
                <td className="px-2 py-2">{r.today ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", TONE[r.today])}>{r.today.replace("_", " ")}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="px-2 py-1 text-right"><Button variant="ghost" size="icon" aria-label={`Open ${r.full_name}`} onClick={() => setOpen(r.user_id)}><Pencil aria-hidden /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProfileSheet userId={open} onClose={() => setOpen(null)} />
    </>
  );
}

function AttendanceTab() {
  const qc = useQueryClient();
  const can = useCan();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const q = useStaffDay(date);
  const [marks, setMarks] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setMarks(Object.fromEntries(q.data.filter((r) => r.status).map((r) => [r.user_id, r.status!]))); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api("/hr/attendance", { method: "PUT", body: { date, records: Object.entries(marks).map(([user_id, status]) => ({ user_id, status })) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr"] }); toast.success("Staff attendance saved"); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  const sync = useMutation({
    mutationFn: () => api<{ updated: number }>("/hr/attendance/sync", { method: "POST", query: { date } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["hr", "attendance"] }); toast.success(`${data.updated} staff updated from the attendance machine`); },
  });
  const manage = can("hr.manage");
  const unmarked = (q.data ?? []).filter((r) => !marks[r.user_id]).length;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="date" value={date} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="h-9 rounded-md border bg-background px-3 text-sm" />
        {manage && <>
          <Button variant="outline" size="sm" onClick={() => setMarks((m) => ({ ...Object.fromEntries((q.data ?? []).map((r) => [r.user_id, r.on_leave ? "leave" : "present"])), ...m }))}>Mark the rest present ({unmarked})</Button>
          <Button variant="outline" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}><Fingerprint aria-hidden />From machine</Button>
          <Button size="sm" className="ml-auto" onClick={() => save.mutate()} disabled={!Object.keys(marks).length} loading={save.isPending}><Save aria-hidden />Save</Button>
        </>}
      </div>
      {q.isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <ul className="divide-y rounded-2xl border bg-card">
          {q.data?.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1"><span className="font-medium">{r.full_name}</span> <span className="text-xs text-muted-foreground">{r.designation ?? roleLabel(r.role)}{r.check_in ? ` · in ${r.check_in}` : ""}{r.check_out ? ` · out ${r.check_out}` : ""}{r.on_leave ? " · on approved leave" : ""}</span></span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${r.full_name}'s attendance`}>
                {STATUSES.map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={marks[r.user_id] === v} disabled={!manage} onClick={() => setMarks((m) => ({ ...m, [r.user_id]: v }))}
                    className={cn("rounded-md border px-2 py-1 text-xs font-medium", marks[r.user_id] === v ? TONE[v] : "text-muted-foreground hover:bg-muted")}>{label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function LeaveTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const q = useStaffLeave(false, status || undefined);
  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => api(`/hr/leave/${v.id}/decide`, { method: "POST", body: { approve: v.approve } }),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["hr"] }); toast.success(v.approve ? "Approved" : "Declined"); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  return (
    <>
      <div className="mb-3 flex gap-1.5" role="group" aria-label="Show">
        {[["pending", "Waiting"], ["approved", "Approved"], ["", "All"]].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)} className={cn("rounded-full border px-3 py-1 text-sm", status === v ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{l}</button>
        ))}
      </div>
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" title="No leave requests" /> : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((l) => (
            <li key={l.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2"><p className="font-semibold">{l.full_name}</p><span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold capitalize">{l.status}</span></div>
              <p className="text-sm text-muted-foreground">{l.code} · {format(parseISO(l.from_date), "d MMM")}{l.to_date !== l.from_date ? ` – ${format(parseISO(l.to_date), "d MMM")}` : ""} · {l.days} day{l.days === 1 ? "" : "s"}</p>
              <p className="mt-1 text-sm">{l.reason}</p>
              {l.can_decide && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => decide.mutate({ id: l.id, approve: true })}><Check aria-hidden />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: l.id, approve: false })}><X aria-hidden />Decline</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PayrollTab() {
  const qc = useQueryClient();
  const can = useCan();
  const q = usePayrollRuns();
  const lastMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), "yyyy-MM");
  const [month, setMonth] = useState(lastMonth);
  const gen = useMutation({
    mutationFn: () => api<{ id: string }>("/hr/payroll", { method: "POST", body: { month } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["hr", "payroll"] }); toast.success("Payslips worked out", { action: { label: "Open", onClick: () => location.assign(`/hr/payroll/${data.id}`) } }); },
    onError: (e) => toast.error(errText(e, "Could not run payroll")),
  });
  return (
    <>
      {can("payroll.manage") && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="Month">{(a) => <Input {...a} type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}</Field>
          <Button onClick={() => gen.mutate()} loading={gen.isPending}><BadgeIndianRupee aria-hidden />Run payroll</Button>
          <p className="text-xs text-muted-foreground">Uses staff attendance and leave for the month. Re-run a draft any time.</p>
        </div>
      )}
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" title="No payroll yet" /> : (
        <ul className="divide-y rounded-2xl border bg-card">
          {q.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <span className="w-36 font-semibold">{format(parseISO(`${r.month}-01`), "MMMM yyyy")}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", r.status === "paid" ? "bg-success/10 text-success" : r.status === "finalised" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning")}>{r.status}</span>
              <span className="text-sm text-muted-foreground">{r.staff} staff · net {inr(r.net)}</span>
              <Link href={`/hr/payroll/${r.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}>Open</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function HrPage() {
  const can = useCan();
  const [tab, setTab] = useState(useSearchParams().get("tab") ?? "staff");
  return (
    <>
      <PageHeader title="HR and payroll" description="Staff records, staff attendance, leave and monthly payroll." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-5">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {can("payroll.view") && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
        </TabsList>
      </Tabs>
      {tab === "staff" && <StaffTab />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "leave" && <LeaveTab />}
      {tab === "payroll" && <PayrollTab />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="hr.view"><Suspense><HrPage /></Suspense></PermissionGate>;
}


