"use client";

import { Hotel, Phone } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useMyHostel } from "@/lib/queries";

export default function MyHostelPage() {
  const q = useMyHostel();
  return (
    <>
      <PageHeader title="Hostel" description="Hostel, room and warden details." />
      {q.isLoading ? <Skeleton className="h-32 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Hotel className="size-12 text-muted-foreground/60" aria-hidden />} title="Not staying in a hostel" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((h) => (
            <li key={h.student_id} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{h.name}</p>
              <p className="mt-1 font-heading text-xl font-bold">{h.hostel} · Room {h.room}</p>
              <p className="text-sm text-muted-foreground">{h.floor ? `${h.floor} floor · ` : ""}since {formatDate(h.since)}</p>
              {h.warden && (
                <p className="mt-3 flex items-center gap-2 text-sm">Warden: <span className="font-medium">{h.warden}</span>
                  {h.warden_phone && <a href={`tel:${h.warden_phone}`} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"><Phone className="size-3.5" aria-hidden />{h.warden_phone}</a>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
