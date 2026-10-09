"use client";

import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Bus, CheckCircle2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyTransport } from "@/lib/queries";

const BusMap = dynamic(() => import("@/components/transport/bus-map").then((m) => m.BusMap), { ssr: false, loading: () => <Skeleton className="h-80 rounded-xl" /> });
const EVENT: Record<string, string> = { boarded: "Got on the bus", dropped: "Got off the bus", absent: "Didn't come to the stop" };

export default function MyTransportPage() {
  const q = useMyTransport();
  return (
    <>
      <PageHeader title="School bus" description="Where the bus is, and when your child got on and off today." />
      {q.isLoading ? <Skeleton className="h-80 rounded-2xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Bus className="size-12 text-muted-foreground/60" aria-hidden />} title="Nothing to show" />
      ) : (
        <div className="space-y-8">
          {q.data.map((c) => (
            <section key={c.student_id} aria-label={c.name}>
              <h2 className="mb-1 font-heading text-lg font-bold">{c.name}</h2>
              {!c.route ? <p className="text-sm text-muted-foreground">Doesn&apos;t use school transport.</p> : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {c.route.name} · {c.route.vehicle_number ?? "bus"}{c.route.driver_name ? ` · driver ${c.route.driver_name}` : ""}
                    {c.stop && <> · <MapPin className="inline size-3.5" aria-hidden /> {c.stop.name}{c.stop.pickup_time ? ` (pickup ${c.stop.pickup_time}` : ""}{c.stop.drop_time ? `, drop ${c.stop.drop_time})` : c.stop.pickup_time ? ")" : ""}</>}
                  </p>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    {c.trip ? (
                      <BusMap buses={[{ id: c.trip.id, label: c.trip.vehicle_number ?? "Bus", lat: c.trip.lat, lng: c.trip.lng, stale: c.trip.stale, path: c.trip.path }]}
                        stops={c.route.stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, mine: s.id === c.stop?.id }))} />
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">The bus isn&apos;t on the road right now.</div>
                    )}
                    <div className="rounded-xl border bg-card p-4">
                      {c.trip && (
                        <p className="mb-3 text-sm">
                          <span className="font-semibold">{c.trip.direction === "pickup" ? "On the way to school" : "On the way home"}</span>
                          <span className="block text-xs text-muted-foreground">{c.trip.last_ping_at ? `Updated ${formatDistanceToNowStrict(parseISO(c.trip.last_ping_at))} ago` : "Waiting for the first position"}{c.trip.speed != null ? ` · ${Math.round(c.trip.speed)} km/h` : ""}</span>
                        </p>
                      )}
                      <h3 className="mb-2 text-sm font-semibold">Today</h3>
                      {c.today.length === 0 ? <p className="text-sm text-muted-foreground">No bus updates yet today.</p> : (
                        <ol className="space-y-2 text-sm">
                          {c.today.map((e, i) => (
                            <li key={i} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" aria-hidden />{EVENT[e.event] ?? e.event}
                              <span className="ml-auto text-xs text-muted-foreground">{format(parseISO(e.at), "h:mm a")}</span></li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
