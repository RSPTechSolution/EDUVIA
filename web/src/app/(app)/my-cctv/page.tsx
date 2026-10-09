"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cctv, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useCameras, useCctvSettings, useMyConsent } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function MyCctvPage() {
  const qc = useQueryClient();
  const me = useSession();
  const settings = useCctvSettings();
  const consent = useMyConsent();
  const cameras = useCameras();
  const answer = useMutation({
    mutationFn: (b: { student_id: string; consent: boolean }) => api("/cctv/consent", { method: "PUT", body: b }),
    onSuccess: (_, b) => { qc.invalidateQueries({ queryKey: ["cctv"] }); toast.success(b.consent ? "Thank you. Your consent is recorded." : "Recorded. Classroom viewing stays closed for this class."); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save"),
  });
  const watch = useMutation({
    mutationFn: (id: string) => api<{ stream_url: string }>(`/cctv/cameras/${id}/watch`, { method: "POST" }),
    onSuccess: ({ data }) => window.open(data.stream_url, "_blank", "noopener"),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Can't open the camera"),
  });
  return (
    <>
      <PageHeader title="Classroom CCTV" description="The school's camera policy, your consent, and live viewing when the whole class agrees." />
      <section className="mb-6 rounded-2xl border bg-card p-5">
        <h2 className="mb-2 font-semibold">Policy</h2>
        {settings.isLoading ? <Skeleton className="h-16" /> : <p className="text-sm whitespace-pre-line text-muted-foreground">{settings.data?.policy}</p>}
      </section>
      <h2 className="mb-3 font-heading text-lg font-bold">Your consent</h2>
      {consent.isLoading ? <Skeleton className="h-24 rounded-xl" /> : (
        <ul className="mb-8 grid gap-3 lg:grid-cols-2">
          {consent.data?.map((c) => (
            <li key={c.student_id} className="rounded-xl border bg-card p-4">
              <p className="font-semibold">{c.name} <span className="text-sm font-normal text-muted-foreground">· {c.class_section}</span></p>
              <p className="text-sm text-muted-foreground">{c.consent == null ? "You haven't answered yet." : `You said ${c.consent ? "yes" : "no"} on ${formatDate(c.decided_at)}.`}</p>
              {me.role === "parent" && (
                <div className="mt-3 flex gap-2" role="group" aria-label={`Consent for ${c.name}`}>
                  <Button size="sm" variant={c.consent === true ? "default" : "outline"} aria-pressed={c.consent === true} onClick={() => answer.mutate({ student_id: c.student_id, consent: true })}>I agree</Button>
                  <Button size="sm" variant={c.consent === false ? "destructive" : "outline"} aria-pressed={c.consent === false} onClick={() => answer.mutate({ student_id: c.student_id, consent: false })}>I don&apos;t agree</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mb-3 font-heading text-lg font-bold">Classroom cameras</h2>
      {cameras.isLoading ? <Skeleton className="h-24 rounded-xl" /> : !cameras.data?.length ? (
        <p className="text-sm text-muted-foreground">No classroom cameras are open to families.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {cameras.data.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-4", c.watchable && "border-success/50")}>
              <Cctv className="size-6 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.watchable ? `${c.section_label} · live now` : c.blocked_reason}</p>
              </div>
              <Button size="sm" disabled={!c.watchable} onClick={() => watch.mutate(c.id)}><ExternalLink aria-hidden />Watch</Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
