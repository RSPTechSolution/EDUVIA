"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BedDouble, DoorOpen, Hotel, LogOut, Pencil, Plus, Save, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StudentPicker } from "@/components/academics/pickers";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { Hostel, HostelRoom } from "@/lib/api/types";
import { formatDate, inr } from "@/lib/format";
import { useHostel, useHostels, useStaffDirectory } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const KINDS = { boys: "Boys", girls: "Girls", mixed: "Mixed" } as const;

function HostelDialog({ hostel, open, onOpenChange }: { hostel: Hostel | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const staff = useStaffDirectory();
  const [f, setF] = useState({ name: "", kind: "girls", warden_id: "none", monthly_fee: "0", address: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setF({ name: hostel?.name ?? "", kind: hostel?.kind ?? "girls", warden_id: hostel?.warden_id ?? "none", monthly_fee: String(hostel?.monthly_fee ?? 0), address: hostel?.address ?? "" });
    }
  }, [open, hostel]);
  const save = useMutation({
    mutationFn: () => api<Hostel>(hostel ? `/hostels/${hostel.id}` : "/hostels", { method: hostel ? "PUT" : "POST", body: {
      name: f.name, kind: f.kind, warden_id: f.warden_id === "none" ? null : f.warden_id, monthly_fee: Number(f.monthly_fee) || 0, address: f.address.trim() || null,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success(hostel ? "Hostel updated" : "Hostel added"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const people = staff.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{hostel ? "Edit hostel" : "Add a hostel"}</DialogTitle><DialogDescription>Families see the hostel, room and warden in their app.</DialogDescription></DialogHeader>
        <form id="hostel-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required className="sm:col-span-2">{(a) => <Input {...a} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Sarojini House" />}</Field>
          <Field label="For">
            {(a) => (
              <Select value={f.kind} onValueChange={(v) => setF((x) => ({ ...x, kind: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{KINDS[f.kind as keyof typeof KINDS]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(KINDS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Monthly fee (₹)">{(a) => <Input {...a} type="number" min={0} value={f.monthly_fee} onChange={(e) => setF((x) => ({ ...x, monthly_fee: e.target.value }))} />}</Field>
          <Field label="Warden" className="sm:col-span-2">
            {(a) => (
              <Select value={f.warden_id} onValueChange={(v) => setF((x) => ({ ...x, warden_id: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{f.warden_id === "none" ? "Not set" : people.find((p) => p.user_id === f.warden_id)?.full_name ?? hostel?.warden_name}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="none">Not set</SelectItem>{people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Address" className="sm:col-span-2">{(a) => <Input {...a} value={f.address} onChange={(e) => setF((x) => ({ ...x, address: e.target.value }))} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="hostel-form" disabled={f.name.trim().length < 2} loading={save.isPending}><Save aria-hidden />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllocateDialog({ room, onClose }: { room: HostelRoom | null; onClose: () => void }) {
  const qc = useQueryClient();
  const allocate = useMutation({
    mutationFn: (studentId: string) => api("/hostels/allocations", { method: "POST", body: { student_id: studentId, room_id: room!.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success(`Bed given in room ${room!.number}`); onClose(); },
    onError: (e) => toast.error(errText(e, "Could not allocate")),
  });
  return (
    <Dialog open={Boolean(room)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Room {room?.number}: add a student</DialogTitle><DialogDescription>A student already in another room is moved here.</DialogDescription></DialogHeader>
        <StudentPicker onPick={(s) => allocate.mutate(s.id)} pickedIds={room?.occupants.map((o) => o.student_id)} />
      </DialogContent>
    </Dialog>
  );
}

function HostelDetail({ id, manage }: { id: string; manage: boolean }) {
  const qc = useQueryClient();
  const q = useHostel(id);
  const [room, setRoom] = useState({ number: "", floor: "", capacity: "2" });
  const [adding, setAdding] = useState<HostelRoom | null>(null);
  const addRoom = useMutation({
    mutationFn: () => api(`/hostels/${id}/rooms`, { method: "POST", body: { number: room.number.trim(), floor: room.floor.trim() || null, capacity: Number(room.capacity) || 1 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success("Room added"); setRoom((r) => ({ ...r, number: "" })); },
    onError: (e) => toast.error(errText(e, "Could not add room")),
  });
  const vacate = useMutation({
    mutationFn: (aid: string) => api(`/hostels/allocations/${aid}/vacate`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success("Bed vacated"); },
  });
  if (!q.data) return <Skeleton className="h-64 rounded-xl" />;
  const h = q.data;
  return (
    <section aria-label={`${h.name} rooms`}>
      {manage && (
        <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); addRoom.mutate(); }}>
          <Field label="Room no.">{(a) => <Input {...a} value={room.number} onChange={(e) => setRoom((r) => ({ ...r, number: e.target.value }))} className="w-28" />}</Field>
          <Field label="Floor">{(a) => <Input {...a} value={room.floor} onChange={(e) => setRoom((r) => ({ ...r, floor: e.target.value }))} className="w-32" placeholder="Ground" />}</Field>
          <Field label="Beds">{(a) => <Input {...a} type="number" min={1} max={40} value={room.capacity} onChange={(e) => setRoom((r) => ({ ...r, capacity: e.target.value }))} className="w-20" />}</Field>
          <Button type="submit" variant="outline" disabled={!room.number.trim()} loading={addRoom.isPending}><Plus aria-hidden />Add room</Button>
        </form>
      )}
      {!h.room_list.length ? <EmptyState className="rounded-2xl border bg-card" illustration={<DoorOpen className="size-12 text-muted-foreground/60" aria-hidden />} title="No rooms yet" /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {h.room_list.map((r) => {
            const free = r.capacity - r.occupants.length;
            return (
              <li key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Room {r.number}</p>
                  {r.floor && <span className="text-xs text-muted-foreground">{r.floor}</span>}
                  <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", free > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{free > 0 ? `${free} free` : "Full"}</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {r.occupants.map((o) => (
                    <li key={o.allocation_id} className="flex items-center gap-2">
                      <BedDouble className="size-4 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{o.name} <span className="text-xs text-muted-foreground">· {o.class_section} · since {formatDate(o.from_date, "d MMM")}</span></span>
                      {manage && <Button size="icon" variant="ghost" aria-label={`Vacate ${o.name}`} onClick={() => vacate.mutate(o.allocation_id)}><LogOut aria-hidden /></Button>}
                    </li>
                  ))}
                </ul>
                {manage && free > 0 && <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdding(r)}><UserPlus aria-hidden />Add student</Button>}
              </li>
            );
          })}
        </ul>
      )}
      <AllocateDialog room={adding} onClose={() => setAdding(null)} />
    </section>
  );
}

function HostelPage() {
  const can = useCan();
  const manage = can("hostel.manage");
  const q = useHostels();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Hostel | null | undefined>(undefined);
  useEffect(() => { if (!selected && q.data?.length) setSelected(q.data[0].id); }, [q.data, selected]);
  return (
    <>
      <PageHeader title="Hostel" description="Hostels, rooms and beds, and who stays where."
        actions={manage && <Button onClick={() => setEditing(null)}><Plus aria-hidden />Add hostel</Button>} />
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Hotel className="size-12 text-muted-foreground/60" aria-hidden />} title="No hostels yet" />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((h) => (
              <div key={h.id} className={cn("rounded-xl border bg-card p-4 text-left", selected === h.id && "border-primary ring-2 ring-primary/20")}>
                <button type="button" className="block w-full text-left outline-none focus-visible:underline" onClick={() => setSelected(h.id)} aria-pressed={selected === h.id}>
                  <span className="flex items-center gap-2"><span className="font-semibold">{h.name}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{KINDS[h.kind]}</span></span>
                  <span className="mt-1 block text-sm text-muted-foreground">{h.rooms} rooms · {h.occupied} of {h.beds} beds taken{h.monthly_fee ? ` · ${inr(h.monthly_fee)}/month` : ""}</span>
                  <span className="block text-sm text-muted-foreground">Warden: {h.warden_name ?? "not set"}</span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${h.beds ? (100 * h.occupied) / h.beds : 0}%` }} /></span>
                </button>
                {manage && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEditing(h)}><Pencil aria-hidden />Edit</Button>}
              </div>
            ))}
          </div>
          {selected && <HostelDetail id={selected} manage={manage} />}
        </>
      )}
      {manage && <HostelDialog hostel={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="hostel.view"><HostelPage /></PermissionGate>;
}
