"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BadgeCheck, CalendarClock, DoorOpen, HardHat, LogIn, LogOut, Pencil, Plus, Save, Search, ShieldAlert, ShieldCheck, Ticket, UserCheck, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/common/files";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatCard } from "@/components/common/stat-card";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, fileUrl } from "@/lib/api/client";
import type { GatePass, Visitor, VisitorLookup, Worker } from "@/lib/api/types";
import { formatDate, initials } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { useGateHosts, useGatePasses, useGateSummary, useVisitors, useWorkers } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const time = (iso: string | null) => (iso ? format(parseISO(iso), "h:mm a") : "—");
const PASS_TONE: Record<string, string> = {
  pending: "bg-warning/10 text-warning", approved: "bg-primary/10 text-primary", used: "bg-success/10 text-success", rejected: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground",
};
const PASS_LABEL: Record<string, string> = { pending: "Waiting", approved: "Approved", used: "Left school", rejected: "Declined", cancelled: "Cancelled" };

function Avatar({ fileId, name }: { fileId: string | null; name: string }) {
  if (fileId) {
    // eslint-disable-next-line @next/next/no-img-element -- private API image, not optimisable
    return <img src={fileUrl(fileId)} alt="" className="size-12 shrink-0 rounded-full object-cover" />;
  }
  return <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(name)}</span>;
}

function VerifyPass() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<GatePass | null>(null);
  const verify = useMutation({
    mutationFn: () => api<GatePass>("/gate/passes/verify", { query: { code: code.trim() } }),
    onSuccess: ({ data }) => setFound(data),
    onError: (e) => { setFound(null); toast.error(errText(e, "Could not check the code")); },
  });
  const left = useMutation({
    mutationFn: (id: string) => api<GatePass>(`/gate/passes/${id}/left`, { method: "POST" }),
    onSuccess: ({ data }) => { setFound(data); qc.invalidateQueries({ queryKey: ["gate"] }); toast.success(`${data.student_name} has left. The family has been told.`); setCode(""); },
    onError: (e) => toast.error(errText(e, "Could not mark")),
  });
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><Ticket className="size-4" aria-hidden />Gate pass code</h2>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); verify.mutate(); }}>
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" aria-label="Gate pass code" className="w-40 font-mono text-lg tracking-widest" />
        <Button type="submit" disabled={code.length !== 6} loading={verify.isPending}>Check</Button>
      </form>
      {found && (
        <div className={cn("mt-4 rounded-xl border p-3", found.status === "approved" ? "border-success/60 bg-success/5" : "bg-muted/40")}>
          <div className="flex items-center gap-3">
            <Avatar fileId={found.photo_file_id} name={found.student_name} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{found.student_name}</p>
              <p className="text-sm text-muted-foreground">{found.class_section}</p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", PASS_TONE[found.status])}>{PASS_LABEL[found.status]}</span>
          </div>
          <p className="mt-3 text-sm">Going with <span className="font-semibold">{found.pickup_name}</span> ({found.pickup_relation}){found.pickup_phone ? ` · ${found.pickup_phone}` : ""}</p>
          <p className="text-sm text-muted-foreground">{found.reason} · from {time(found.leave_at)}</p>
          {found.status === "approved"
            ? <Button className="mt-3" onClick={() => left.mutate(found.id)} loading={left.isPending}><LogOut aria-hidden />Check the person&apos;s ID, then let them leave</Button>
            : found.used_at && <p className="mt-2 text-sm font-medium text-success">Left at {time(found.used_at)} · checked by {found.verified_by}</p>}
        </div>
      )}
    </section>
  );
}

function CheckInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const staff = useGateHosts(open);
  const empty = { name: "", phone: "", purpose: "", host_id: "none", meeting: "", id_proof: "", vehicle_no: "", people: "1", badge_no: "" };
  const [f, setF] = useState(empty);
  const [known, setKnown] = useState<VisitorLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phone = useDebounced(f.phone.replace(/\D/g, ""));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setF(empty); setKnown(null); setError(null); } }, [open]);
  useEffect(() => {
    if (phone.length < 10) { setKnown(null); return; }
    api<VisitorLookup | null>("/gate/visitors/lookup", { query: { phone } }).then(({ data }) => {
      setKnown(data);
      if (data) setF((x) => ({ ...x, name: x.name || data.name, purpose: x.purpose || data.purpose, meeting: x.meeting || (data.meeting ?? "") }));
    }).catch(() => setKnown(null));
  }, [phone]);
  const save = useMutation({
    mutationFn: () => api<Visitor>("/gate/visitors", { method: "POST", body: {
      name: f.name, phone: f.phone.trim() || null, purpose: f.purpose, host_id: f.host_id === "none" ? null : f.host_id, meeting: f.meeting.trim() || null,
      id_proof: f.id_proof.trim() || null, vehicle_no: f.vehicle_no.trim() || null, people: Number(f.people) || 1, badge_no: f.badge_no.trim() || null,
    } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success(`${data.name} checked in${data.host_name ? `. ${data.host_name} has been told.` : ""}`); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not check in")),
  });
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const people = staff.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Visitor check-in</DialogTitle><DialogDescription>Type the phone number first: returning visitors fill in by themselves.</DialogDescription></DialogHeader>
        <form id="visitor-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Phone" hint={known ? `Visited ${known.visits} time${known.visits === 1 ? "" : "s"} before` : undefined}>{(a) => <Input {...a} type="tel" value={f.phone} onChange={set("phone")} placeholder="+91 98765 43210" />}</Field>
          <Field label="Name" required>{(a) => <Input {...a} value={f.name} onChange={set("name")} />}</Field>
          <Field label="Purpose" required className="sm:col-span-2">{(a) => <Input {...a} value={f.purpose} onChange={set("purpose")} placeholder="e.g. Fee enquiry, delivery, meeting" />}</Field>
          <Field label="To meet (staff)">
            {(a) => (
              <Select value={f.host_id} onValueChange={(v) => setF((x) => ({ ...x, host_id: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{f.host_id === "none" ? "Not a staff member" : people.find((p) => p.user_id === f.host_id)?.full_name}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="none">Not a staff member</SelectItem>{people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}{p.designation ? ` · ${p.designation}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          {f.host_id === "none" && <Field label="Or write who">{(a) => <Input {...a} value={f.meeting} onChange={set("meeting")} placeholder="e.g. Accounts office" />}</Field>}
          <Field label="ID shown" hint="Only the last 4 digits">{(a) => <Input {...a} value={f.id_proof} onChange={set("id_proof")} placeholder="Aadhaar ••••4321" />}</Field>
          <Field label="Vehicle no.">{(a) => <Input {...a} value={f.vehicle_no} onChange={set("vehicle_no")} />}</Field>
          <Field label="People">{(a) => <Input {...a} type="number" min={1} max={50} value={f.people} onChange={set("people")} />}</Field>
          <Field label="Badge no.">{(a) => <Input {...a} value={f.badge_no} onChange={set("badge_no")} placeholder="V-12" />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="visitor-form" disabled={f.name.trim().length < 2 || f.purpose.trim().length < 2} loading={save.isPending}><LogIn aria-hidden />Check in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisitorRow({ v, manage }: { v: Visitor; manage: boolean }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: (what: "arrive" | "out" | "cancel") => api<Visitor>(`/gate/visitors/${v.id}/${what}`, { method: "POST", body: what === "arrive" ? {} : undefined }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success(data.status === "in" ? `${data.name} checked in` : data.status === "out" ? `${data.name} checked out` : "Visit cancelled"); },
    onError: (e) => toast.error(errText(e, "Could not update")),
  });
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      {manage && v.status === "in" ? (
        <PhotoUpload fileId={v.photo_file_id} purpose="visitor_photo" ownerId={v.id} canEdit fallback={initials(v.name)} className="size-10" onChanged={() => qc.invalidateQueries({ queryKey: ["gate"] })} />
      ) : <Avatar fileId={v.photo_file_id} name={v.name} />}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{v.name}{v.people > 1 && <span className="text-muted-foreground"> +{v.people - 1}</span>} {v.badge_no && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{v.badge_no}</span>}</p>
        <p className="text-sm text-muted-foreground">{v.purpose}{v.meeting ? ` · to see ${v.meeting}` : ""}{v.phone ? ` · ${v.phone}` : ""}{v.vehicle_no ? ` · ${v.vehicle_no}` : ""}</p>
      </div>
      <span className="text-right text-xs text-muted-foreground">
        {v.status === "expected" ? <>Expected {v.expected_on && formatDate(v.expected_on, "d MMM")}</> : <>In {time(v.in_at)}{v.out_at && <> · out {time(v.out_at)}</>}</>}
      </span>
      {manage && v.status === "expected" && <Button size="sm" onClick={() => act.mutate("arrive")} loading={act.isPending}><LogIn aria-hidden />Arrived</Button>}
      {manage && v.status === "in" && <Button size="sm" variant="outline" onClick={() => act.mutate("out")} loading={act.isPending}><LogOut aria-hidden />Out</Button>}
      {v.can_cancel && v.status === "expected" && <Button size="sm" variant="ghost" onClick={() => act.mutate("cancel")}>Cancel</Button>}
    </li>
  );
}

function GateDesk() {
  const can = useCan();
  const manage = can("gate.manage");
  const today = format(new Date(), "yyyy-MM-dd");
  const summary = useGateSummary();
  const visitors = useVisitors(today);
  const workers = useWorkers("");
  const [checkIn, setCheckIn] = useState(false);
  const s = summary.data;
  const inside = (visitors.data ?? []).filter((v) => v.status === "in");
  const expected = (visitors.data ?? []).filter((v) => v.status === "expected");
  const workersIn = (workers.data ?? []).filter((w) => w.on_campus_since);
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors on campus" value={s?.visitors_inside ?? 0} hint={`${s?.visitors_today ?? 0} today`} icon={Users} loading={summary.isLoading} />
        <StatCard label="Expected today" value={s?.expected_today ?? 0} icon={CalendarClock} accent="info" loading={summary.isLoading} />
        <StatCard label="Workers on campus" value={s?.workers_inside ?? 0} icon={HardHat} accent="warning" loading={summary.isLoading} />
        <StatCard label="Early pickups today" value={s?.passes_today ?? 0} hint={s?.passes_pending ? `${s.passes_pending} waiting for approval` : undefined} icon={Ticket} accent="success" loading={summary.isLoading} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <h2 className="font-semibold">On campus now</h2>
              {manage && <Button size="sm" className="ml-auto" onClick={() => setCheckIn(true)}><Plus aria-hidden />Visitor check-in</Button>}
            </div>
            {visitors.isLoading ? <Skeleton className="m-4 h-24" /> : !inside.length ? <p className="px-4 py-6 text-sm text-muted-foreground">No visitors inside.</p> : (
              <ul className="divide-y">{inside.map((v) => <VisitorRow key={v.id} v={v} manage={manage} />)}</ul>
            )}
          </section>
          {expected.length > 0 && (
            <section className="rounded-2xl border bg-card">
              <h2 className="border-b px-4 py-3 font-semibold">Expected today</h2>
              <ul className="divide-y">{expected.map((v) => <VisitorRow key={v.id} v={v} manage={manage} />)}</ul>
            </section>
          )}
        </div>
        <div className="space-y-5">
          {manage && <VerifyPass />}
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-2 font-semibold"><HardHat className="size-4" aria-hidden />Workers inside</h2>
            {!workersIn.length ? <p className="text-sm text-muted-foreground">None right now.</p> : (
              <ul className="space-y-1.5 text-sm">{workersIn.map((w) => <li key={w.id} className="flex justify-between gap-2"><span>{w.name} <span className="text-muted-foreground">· {w.trade}</span></span><span className="text-muted-foreground">{time(w.on_campus_since)}</span></li>)}</ul>
            )}
          </section>
        </div>
      </div>
      {manage && <CheckInDialog open={checkIn} onOpenChange={setCheckIn} />}
    </>
  );
}

function VisitorsTab() {
  const can = useCan();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const q = useVisitors(date);
  return (
    <>
      <div className="mb-3 flex items-end gap-2">
        <Field label="Day">{(a) => <Input {...a} type="date" value={date} onChange={(e) => setDate(e.target.value || format(new Date(), "yyyy-MM-dd"))} className="w-44" />}</Field>
        <p className="pb-2 text-sm text-muted-foreground">{q.data?.length ?? 0} visits</p>
      </div>
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" title="No visitors this day" /> : (
        <ul className="divide-y rounded-2xl border bg-card">{q.data.map((v) => <VisitorRow key={v.id} v={v} manage={can("gate.manage")} />)}</ul>
      )}
    </>
  );
}

function PassesTab() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const q = useGatePasses(date);
  return (
    <>
      <div className="mb-3 flex items-end gap-2">
        <Field label="Day">{(a) => <Input {...a} type="date" value={date} onChange={(e) => setDate(e.target.value || format(new Date(), "yyyy-MM-dd"))} className="w-44" />}</Field>
      </div>
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" title="No gate passes this day" /> : (
        <ul className="divide-y rounded-2xl border bg-card">
          {q.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar fileId={p.photo_file_id} name={p.student_name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.student_name} <span className="text-sm font-normal text-muted-foreground">· {p.class_section}</span></p>
                <p className="text-sm text-muted-foreground">{time(p.leave_at)} with {p.pickup_name} ({p.pickup_relation}) · {p.reason}</p>
              </div>
              {p.code && p.status === "approved" && <span className="font-mono text-sm tracking-widest">{p.code}</span>}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", PASS_TONE[p.status])}>{PASS_LABEL[p.status]}{p.used_at ? ` ${time(p.used_at)}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function WorkerDialog({ worker, open, onOpenChange }: { worker: Worker | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const empty = { name: "", phone: "", trade: "", agency: "", id_proof: "", police_verified: false, verified_on: "", valid_until: "", is_active: true, notes: "" };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setF(worker ? { name: worker.name, phone: worker.phone ?? "", trade: worker.trade, agency: worker.agency ?? "", id_proof: worker.id_proof ?? "", police_verified: worker.police_verified,
        verified_on: worker.verified_on ?? "", valid_until: worker.valid_until ?? "", is_active: worker.is_active, notes: worker.notes ?? "" } : empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worker]);
  const save = useMutation({
    mutationFn: () => api(worker ? `/gate/workers/${worker.id}` : "/gate/workers", { method: worker ? "PUT" : "POST", body: {
      ...f, phone: f.phone.trim() || null, agency: f.agency.trim() || null, id_proof: f.id_proof.trim() || null, verified_on: f.verified_on || null,
      valid_until: f.valid_until || null, notes: f.notes.trim() || null,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success("Saved"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const set = (k: "name" | "phone" | "trade" | "agency" | "id_proof" | "verified_on" | "valid_until" | "notes") => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{worker ? worker.name : "Add a worker"}</DialogTitle><DialogDescription>Workers can only come in once police verification is recorded.</DialogDescription></DialogHeader>
        <form id="worker-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required>{(a) => <Input {...a} value={f.name} onChange={set("name")} />}</Field>
          <Field label="Work" required>{(a) => <Input {...a} value={f.trade} onChange={set("trade")} placeholder="Housekeeping, canteen…" />}</Field>
          <Field label="Phone">{(a) => <Input {...a} type="tel" value={f.phone} onChange={set("phone")} />}</Field>
          <Field label="Agency">{(a) => <Input {...a} value={f.agency} onChange={set("agency")} />}</Field>
          <Field label="ID proof">{(a) => <Input {...a} value={f.id_proof} onChange={set("id_proof")} placeholder="Aadhaar ••••4321" />}</Field>
          <Field label="Pass valid until">{(a) => <Input {...a} type="date" value={f.valid_until} onChange={set("valid_until")} />}</Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.police_verified} onCheckedChange={(v) => setF((x) => ({ ...x, police_verified: v }))} />Police verification done</label>
          {f.police_verified && <Field label="Verified on" required>{(a) => <Input {...a} type="date" value={f.verified_on} onChange={set("verified_on")} />}</Field>}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF((x) => ({ ...x, is_active: v }))} />Active</label>
          <Field label="Notes" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={f.notes} onChange={set("notes")} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="worker-form" disabled={f.name.trim().length < 2 || f.trade.trim().length < 2} loading={save.isPending}><Save aria-hidden />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkersTab() {
  const qc = useQueryClient();
  const can = useCan();
  const [search, setSearch] = useState("");
  const q = useWorkers(useDebounced(search.trim()));
  const [editing, setEditing] = useState<Worker | null | undefined>(undefined);
  const move = useMutation({
    mutationFn: ({ id, dir }: { id: string; dir: "in" | "out" }) => api<Worker>(`/gate/workers/${id}/${dir}`, { method: "POST" }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["gate"] }); toast.success(data.on_campus_since ? `${data.name} is in` : `${data.name} has left`); },
    onError: (e) => toast.error(errText(e, "Could not update")),
  });
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, work or agency" className="h-9 pl-9" aria-label="Search workers" />
        </div>
        {can("workers.manage") && <Button className="ml-auto" onClick={() => setEditing(null)}><Plus aria-hidden />Add worker</Button>}
      </div>
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" illustration={<HardHat className="size-12 text-muted-foreground/60" aria-hidden />} title="No workers registered" /> : (
        <ul className="divide-y rounded-2xl border bg-card">
          {q.data.map((w) => (
            <li key={w.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !w.is_active && "opacity-60")}>
              {can("gate.manage") ? <PhotoUpload fileId={w.photo_file_id} purpose="worker_photo" ownerId={w.id} canEdit fallback={initials(w.name)} className="size-10" onChanged={() => qc.invalidateQueries({ queryKey: ["gate"] })} /> : <Avatar fileId={w.photo_file_id} name={w.name} />}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{w.name} <span className="text-sm font-normal text-muted-foreground">· {w.trade}{w.agency ? `, ${w.agency}` : ""}</span></p>
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  {w.police_verified ? <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="size-3.5" aria-hidden />Police verified {formatDate(w.verified_on, "d MMM yyyy")}</span>
                    : <span className="inline-flex items-center gap-1 text-destructive"><ShieldAlert className="size-3.5" aria-hidden />Not verified</span>}
                  {w.valid_until && <span className="text-muted-foreground">Pass until {formatDate(w.valid_until)}</span>}
                  {w.blocked_reason && w.police_verified && <span className="text-destructive">{w.blocked_reason}</span>}
                </p>
              </div>
              {w.on_campus_since && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">In since {time(w.on_campus_since)}</span>}
              {can("gate.manage") && (w.on_campus_since
                ? <Button size="sm" variant="outline" onClick={() => move.mutate({ id: w.id, dir: "out" })}><LogOut aria-hidden />Out</Button>
                : <Button size="sm" disabled={!w.can_enter} title={w.blocked_reason ?? undefined} onClick={() => move.mutate({ id: w.id, dir: "in" })}><LogIn aria-hidden />In</Button>)}
              {can("workers.manage") && <Button size="icon" variant="ghost" aria-label={`Edit ${w.name}`} onClick={() => setEditing(w)}><Pencil aria-hidden /></Button>}
            </li>
          ))}
        </ul>
      )}
      {can("workers.manage") && <WorkerDialog worker={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />}
    </>
  );
}

function GatePage() {
  const [tab, setTab] = useState(useSearchParams().get("tab") ?? "desk");
  return (
    <>
      <PageHeader title="Gate and security" description="Visitors, early pickups with a gate pass, and contract workers." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-5">
        <TabsList>
          <TabsTrigger value="desk"><DoorOpen aria-hidden />Gate desk</TabsTrigger>
          <TabsTrigger value="visitors"><UserCheck aria-hidden />Visitors</TabsTrigger>
          <TabsTrigger value="passes"><BadgeCheck aria-hidden />Gate passes</TabsTrigger>
          <TabsTrigger value="workers"><HardHat aria-hidden />Workers</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "desk" && <GateDesk />}
      {tab === "visitors" && <VisitorsTab />}
      {tab === "passes" && <PassesTab />}
      {tab === "workers" && <WorkersTab />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="gate.view"><Suspense><GatePage /></Suspense></PermissionGate>;
}
