"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { AlertOctagon, Bus, MapPin, Pencil, Plus, Route as RouteIcon, Trash2, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { StudentPicker } from "@/components/academics/pickers";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api/client";
import type { BusRoute, Vehicle } from "@/lib/api/types";
import { formatDate, formatDateTime, inr } from "@/lib/format";
import { useBusRoutes, useLiveTrips, useRiders, useSosAlerts, useVehicles } from "@/lib/queries";
import { cn } from "@/lib/utils";

// The map draws inside a box of fixed height, which its loading placeholder fills, so nothing moves when it appears.
const BusMap = dynamic(() => import("@/components/transport/bus-map").then((m) => m.BusMap), { ssr: false, loading: () => <Skeleton className="h-full rounded-xl" /> });
const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);

function LiveTab() {
  const q = useLiveTrips();
  if (q.isLoading) return <Skeleton className="h-[28rem] rounded-xl" />;
  const trips = q.data ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="h-[28rem]">
        <BusMap buses={trips.map((t) => ({ id: t.id, label: t.vehicle_number ?? t.route_name, lat: t.lat, lng: t.lng, stale: t.stale, path: t.path }))}
          stops={trips.flatMap((t) => t.stops)} className="h-full" />
      </div>
      <div>
        <h2 className="mb-2 font-semibold">Running now ({trips.length})</h2>
        {trips.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No bus is on the road.</p> : (
          <ul className="space-y-2">
            {trips.map((t) => (
              <li key={t.id} className="rounded-xl border bg-card p-3 text-sm">
                <p className="font-semibold">{t.route_name} <span className="font-normal text-muted-foreground">· {t.direction === "pickup" ? "to school" : "home"}</span></p>
                <p className="text-xs text-muted-foreground">{t.vehicle_number} · {t.driver_name}{t.driver_phone ? ` · ${t.driver_phone}` : ""}</p>
                <p className="mt-1 text-xs">{t.on_board} of {t.riders} on board{t.speed != null ? ` · ${Math.round(t.speed)} km/h` : ""}</p>
                <p className={cn("text-xs", t.stale ? "font-medium text-warning" : "text-muted-foreground")}>
                  {t.last_ping_at ? `Position ${formatDistanceToNowStrict(parseISO(t.last_ping_at))} ago` : "No position yet"}{t.stale ? " · check with the driver" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RouteDialog({ route, vehicles, open, onOpenChange }: { route: BusRoute | null; vehicles: Vehicle[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [vehicleId, setVehicleId] = useState("none");
  const [fee, setFee] = useState("0");
  const [stops, setStops] = useState<{ name: string; lat: string; lng: string; pickup_time: string; drop_time: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(route?.name ?? ""); setVehicleId(route?.vehicle_id ?? "none"); setFee(String(route?.monthly_fee ?? 0)); setError(null);
    setStops(route?.stops.map((s) => ({ name: s.name, lat: s.lat?.toString() ?? "", lng: s.lng?.toString() ?? "", pickup_time: s.pickup_time ?? "", drop_time: s.drop_time ?? "" }))
      ?? [{ name: "", lat: "", lng: "", pickup_time: "", drop_time: "" }]);
  }, [open, route]);
  const save = useMutation({
    mutationFn: () => {
      const body = { name, vehicle_id: vehicleId === "none" ? null : vehicleId, monthly_fee: Number(fee) || 0,
        stops: stops.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), lat: s.lat ? Number(s.lat) : null, lng: s.lng ? Number(s.lng) : null,
          pickup_time: s.pickup_time || null, drop_time: s.drop_time || null })) };
      return route ? api(`/transport/routes/${route.id}`, { method: "PUT", body }) : api("/transport/routes", { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport"] }); toast.success("Route saved"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const upd = (i: number, k: string, v: string) => setStops((x) => x.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>{route ? "Edit route" : "New route"}</DialogTitle><DialogDescription>Stops in the order the bus reaches them in the morning.</DialogDescription></DialogHeader>
        <form id="route-form" className="max-h-[62vh] space-y-4 overflow-y-auto px-0.5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" required>{(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} placeholder="Route 3 – Sector 44" maxLength={100} />}</Field>
            <Field label="Bus">
              {(a) => (
                <Select value={vehicleId} onValueChange={(v) => setVehicleId(String(v))}>
                  <SelectTrigger id={a.id} className="w-full"><SelectValue>{vehicleId === "none" ? "Not assigned" : vehicles.find((v) => v.id === vehicleId)?.number}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="none">Not assigned</SelectItem>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.number}{v.driver_name ? ` · ${v.driver_name}` : ""}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Monthly fee (₹)">{(a) => <Input {...a} type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />}</Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Stops</legend>
            <div className="space-y-2">
              {stops.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1.6fr_1fr_1fr_6rem_6rem_2.25rem]">
                  <Input value={s.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder={`Stop ${i + 1}`} aria-label={`Stop ${i + 1} name`} className="col-span-2 sm:col-span-1" />
                  <Input value={s.lat} onChange={(e) => upd(i, "lat", e.target.value)} placeholder="Latitude" aria-label={`Stop ${i + 1} latitude`} inputMode="decimal" />
                  <Input value={s.lng} onChange={(e) => upd(i, "lng", e.target.value)} placeholder="Longitude" aria-label={`Stop ${i + 1} longitude`} inputMode="decimal" />
                  <Input type="time" value={s.pickup_time} onChange={(e) => upd(i, "pickup_time", e.target.value)} aria-label={`Stop ${i + 1} pickup time`} />
                  <Input type="time" value={s.drop_time} onChange={(e) => upd(i, "drop_time", e.target.value)} aria-label={`Stop ${i + 1} drop time`} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove stop ${i + 1}`} onClick={() => setStops((x) => x.filter((_, j) => j !== i))}><Trash2 aria-hidden /></Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setStops((x) => [...x, { name: "", lat: "", lng: "", pickup_time: "", drop_time: "" }])}><Plus aria-hidden />Add stop</Button>
            <p className="mt-1 text-xs text-muted-foreground">Latitude and longitude are optional; with them, stops appear on the map. Right-click a place in Google Maps to copy them.</p>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="route-form" disabled={!name.trim()} loading={save.isPending}>Save route</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RidersPanel({ route }: { route: BusRoute }) {
  const qc = useQueryClient();
  const can = useCan();
  const q = useRiders(route.id);
  const [stopId, setStopId] = useState(route.stops[0]?.id ?? "none");
  const assign = useMutation({
    mutationFn: (v: { student_id: string; route_id: string | null; stop_id?: string | null }) => api("/transport/assignments", { method: "PUT", body: v }),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["transport"] }); toast.success(v.route_id ? "Added to the route" : "Removed from transport"); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {can("transport.manage") && (
        <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Select value={stopId} onValueChange={(v) => setStopId(String(v))}>
            <SelectTrigger aria-label="Stop for the new rider"><SelectValue>{route.stops.find((s) => s.id === stopId)?.name ?? "No stop"}</SelectValue></SelectTrigger>
            <SelectContent>{route.stops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <StudentPicker onPick={(s) => assign.mutate({ student_id: s.id, route_id: route.id, stop_id: stopId === "none" ? null : stopId })} pickedIds={q.data?.map((r) => r.student_id)} />
        </div>
      )}
      {q.isLoading ? <Skeleton className="h-16" /> : !q.data?.length ? <p className="text-sm text-muted-foreground">No students on this route yet.</p> : (
        <ul className="divide-y text-sm">
          {q.data.map((r) => (
            <li key={r.student_id} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1"><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">{r.class_section}</span></span>
              <span className="text-xs text-muted-foreground">{r.stop_name ?? "No stop"}</span>
              {can("transport.manage") && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => assign.mutate({ student_id: r.student_id, route_id: null })}>Remove</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoutesTab() {
  const can = useCan();
  const qc = useQueryClient();
  const routes = useBusRoutes();
  const vehicles = useVehicles();
  const [editing, setEditing] = useState<{ open: boolean; route: BusRoute | null }>({ open: false, route: null });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BusRoute | null>(null);
  const remove = useMutation({ mutationFn: (id: string) => api(`/transport/routes/${id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport"] }); setRemoving(null); } });
  if (routes.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <>
      {can("transport.manage") && <Button className="mb-3" onClick={() => setEditing({ open: true, route: null })}><Plus aria-hidden />New route</Button>}
      {!routes.data?.length ? <EmptyState className="rounded-2xl border bg-card" illustration={<RouteIcon className="size-12 text-muted-foreground/60" aria-hidden />} title="No routes yet" /> : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {routes.data.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">{r.vehicle_number ?? "No bus"}{r.driver_name ? ` · ${r.driver_name}` : ""} · {r.riders}{r.capacity ? `/${r.capacity}` : ""} riders{r.monthly_fee ? ` · ${inr(r.monthly_fee)}/month` : ""}</p>
                </div>
                {can("transport.manage") && <>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => setEditing({ open: true, route: r })}><Pencil aria-hidden /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${r.name}`} onClick={() => setRemoving(r)}><Trash2 aria-hidden /></Button>
                </>}
              </div>
              <ol className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {r.stops.map((s) => <li key={s.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"><MapPin className="size-3" aria-hidden />{s.name}{s.pickup_time ? ` · ${s.pickup_time}` : ""} <span className="text-muted-foreground">({s.riders})</span></li>)}
              </ol>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded((x) => (x === r.id ? null : r.id))}><Users aria-hidden />{expanded === r.id ? "Hide riders" : "Riders"}</Button>
              {expanded === r.id && <RidersPanel route={r} />}
            </li>
          ))}
        </ul>
      )}
      <RouteDialog route={editing.route} vehicles={vehicles.data ?? []} open={editing.open} onOpenChange={(o) => setEditing((x) => ({ ...x, open: o }))} />
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} destructive pending={remove.isPending}
        title={`Remove ${removing?.name}?`} description="Students on it are taken off transport." confirmLabel="Remove" onConfirm={() => removing && remove.mutate(removing.id)} />
    </>
  );
}

function VehicleDialog({ vehicle, open, onOpenChange }: { vehicle: Vehicle | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const drivers = useQuery({ queryKey: ["transport", "drivers"], enabled: open, queryFn: async () => (await api<{ id: string; full_name: string; phone: string | null }[]>("/transport/drivers")).data });
  const blank = { number: "", model: "", capacity: "40", driver_id: "none", helper_name: "", helper_phone: "", insurance_until: "", fitness_until: "", permit_until: "" };
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setF(vehicle ? { number: vehicle.number, model: vehicle.model ?? "", capacity: String(vehicle.capacity), driver_id: vehicle.driver_id ?? "none",
      helper_name: vehicle.helper_name ?? "", helper_phone: vehicle.helper_phone ?? "", insurance_until: vehicle.insurance_until ?? "",
      fitness_until: vehicle.fitness_until ?? "", permit_until: vehicle.permit_until ?? "" } : blank);
    setError(null);
  }, [open, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v])), capacity: Number(f.capacity), driver_id: f.driver_id === "none" ? null : f.driver_id };
      return vehicle ? api(`/transport/vehicles/${vehicle.id}`, { method: "PUT", body }) : api("/transport/vehicles", { method: "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport"] }); toast.success("Vehicle saved"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{vehicle ? `Edit ${vehicle.number}` : "Add a vehicle"}</DialogTitle><DialogDescription>Document dates are flagged 30 days before they run out.</DialogDescription></DialogHeader>
        <form id="veh-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Registration number" required>{(a) => <Input {...a} value={f.number} onChange={set("number")} placeholder="PB01 AB 1234" />}</Field>
          <Field label="Seats">{(a) => <Input {...a} type="number" min={1} max={120} value={f.capacity} onChange={set("capacity")} />}</Field>
          <Field label="Model">{(a) => <Input {...a} value={f.model} onChange={set("model")} placeholder="Tata Starbus 40" />}</Field>
          <Field label="Driver">
            {(a) => (
              <Select value={f.driver_id} onValueChange={(v) => setF((x) => ({ ...x, driver_id: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{f.driver_id === "none" ? "Not assigned" : drivers.data?.find((d) => d.id === f.driver_id)?.full_name ?? vehicle?.driver_name}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="none">Not assigned</SelectItem>{drivers.data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Helper / attendant">{(a) => <Input {...a} value={f.helper_name} onChange={set("helper_name")} />}</Field>
          <Field label="Helper phone">{(a) => <Input {...a} type="tel" value={f.helper_phone} onChange={set("helper_phone")} />}</Field>
          <Field label="Insurance until">{(a) => <Input {...a} type="date" value={f.insurance_until} onChange={set("insurance_until")} />}</Field>
          <Field label="Fitness certificate until">{(a) => <Input {...a} type="date" value={f.fitness_until} onChange={set("fitness_until")} />}</Field>
          <Field label="Permit until">{(a) => <Input {...a} type="date" value={f.permit_until} onChange={set("permit_until")} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="veh-form" disabled={f.number.trim().length < 4} loading={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VehiclesTab() {
  const can = useCan();
  const q = useVehicles();
  const [editing, setEditing] = useState<{ open: boolean; v: Vehicle | null }>({ open: false, v: null });
  if (q.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <>
      {can("transport.manage") && <Button className="mb-3" onClick={() => setEditing({ open: true, v: null })}><Plus aria-hidden />Add vehicle</Button>}
      {!q.data?.length ? <EmptyState className="rounded-2xl border bg-card" illustration={<Bus className="size-12 text-muted-foreground/60" aria-hidden />} title="No vehicles yet" /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((v) => (
            <li key={v.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><p className="font-mono font-semibold">{v.number}</p><p className="text-sm text-muted-foreground">{v.model ?? "Bus"} · {v.riders}/{v.capacity} seats</p></div>
                {can("transport.manage") && <Button variant="ghost" size="icon" aria-label={`Edit ${v.number}`} onClick={() => setEditing({ open: true, v })}><Pencil aria-hidden /></Button>}
              </div>
              <p className="mt-2 text-sm">{v.driver_name ? <>{v.driver_name}{v.driver_phone && <a className="ml-1 text-primary" href={`tel:${v.driver_phone}`}>{v.driver_phone}</a>}</> : <span className="text-warning">No driver</span>}</p>
              {v.routes.length > 0 && <p className="text-xs text-muted-foreground">{v.routes.join(", ")}</p>}
              {v.expiring.length > 0 && <p className="mt-2 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">Renew soon: {v.expiring.join(", ")}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">Insurance {formatDate(v.insurance_until)} · Fitness {formatDate(v.fitness_until)}</p>
            </li>
          ))}
        </ul>
      )}
      <VehicleDialog vehicle={editing.v} open={editing.open} onOpenChange={(o) => setEditing((x) => ({ ...x, open: o }))} />
    </>
  );
}

function SosTab() {
  const qc = useQueryClient();
  const q = useSosAlerts();
  const [note, setNote] = useState<Record<string, string>>({});
  const resolve = useMutation({
    mutationFn: (id: string) => api(`/transport/sos/${id}/resolve`, { method: "POST", body: { resolution: note[id] || "Handled" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport", "sos"] }); toast.success("Marked as handled"); },
  });
  if (q.isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (!q.data?.length) return <EmptyState className="rounded-2xl border bg-card" title="No SOS alerts" description="Drivers can raise one from the driver app in an emergency." />;
  return (
    <ul className="space-y-3">
      {q.data.map((a) => (
        <li key={a.id} className={cn("rounded-xl border p-4", a.resolved_at ? "bg-card" : "border-destructive/50 bg-destructive/5")}>
          <div className="flex flex-wrap items-center gap-2">
            <AlertOctagon className={cn("size-5", a.resolved_at ? "text-muted-foreground" : "text-destructive")} aria-hidden />
            <p className="font-semibold">{a.raised_by}{a.route_name ? ` · ${a.route_name}` : ""}{a.vehicle_number ? ` · ${a.vehicle_number}` : ""}</p>
            <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(a.raised_at)}</span>
          </div>
          {a.message && <p className="mt-1 text-sm">{a.message}</p>}
          <p className="mt-1 text-sm">
            {a.phone && <a className="text-primary hover:underline" href={`tel:${a.phone}`}>Call {a.phone}</a>}
            {a.lat != null && <a className="ml-3 text-primary hover:underline" href={`https://maps.google.com/?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">Open location</a>}
          </p>
          {a.resolved_at ? <p className="mt-1 text-xs text-muted-foreground">Handled: {a.resolution}</p> : (
            <div className="mt-2 flex gap-2">
              <Input value={note[a.id] ?? ""} onChange={(e) => setNote((x) => ({ ...x, [a.id]: e.target.value }))} placeholder="What was done" aria-label="What was done" className="h-8" />
              <Button size="sm" onClick={() => resolve.mutate(a.id)} loading={resolve.isPending}>Mark handled</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TransportPage() {
  const initial = useSearchParams().get("tab") ?? "live";
  const [tab, setTab] = useState(initial);
  const sos = useSosAlerts();
  const open = sos.data?.filter((a) => !a.resolved_at).length ?? 0;
  return (
    <>
      <PageHeader title="Transport" description="Buses on the road, routes and stops, vehicles and drivers." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-5">
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="sos">SOS{open > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] text-background">{open}</span>}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "live" && <LiveTab />}
      {tab === "routes" && <RoutesTab />}
      {tab === "vehicles" && <VehiclesTab />}
      {tab === "sos" && <SosTab />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="transport.view"><Suspense><TransportPage /></Suspense></PermissionGate>;
}


