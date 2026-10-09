"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Cctv, ExternalLink, Pencil, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { Camera, CctvSettings } from "@/lib/api/types";
import { roleLabel } from "@/lib/format";
import { useCameras, useCctvSettings, useCctvViews, useClasses, useConsentCoverage } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);

function CameraDialog({ camera, open, onOpenChange }: { camera: Camera | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const classes = useClasses(open);
  const sections = (classes.data ?? []).flatMap((c) => c.sections.map((s) => ({ id: s.id, label: `${c.name} – ${s.name}` })));
  const [f, setF] = useState({ name: "", location: "", section_id: "none", stream_url: "", parent_viewable: false, is_active: true });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setF({ name: camera?.name ?? "", location: camera?.location ?? "", section_id: camera?.section_id ?? "none", stream_url: camera?.stream_url ?? "",
        parent_viewable: camera?.parent_viewable ?? false, is_active: camera?.is_active ?? true });
    }
  }, [open, camera]);
  const save = useMutation({
    mutationFn: () => api(camera ? `/cctv/cameras/${camera.id}` : "/cctv/cameras", { method: camera ? "PUT" : "POST", body: {
      ...f, location: f.location.trim() || null, section_id: f.section_id === "none" ? null : f.section_id, stream_url: f.stream_url.trim() || null,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cctv"] }); toast.success("Camera saved"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{camera ? camera.name : "Add a camera"}</DialogTitle><DialogDescription>The stream link comes from your NVR or camera app. Families never see it.</DialogDescription></DialogHeader>
        <form id="cam-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required>{(a) => <Input {...a} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Class 4-A camera" />}</Field>
          <Field label="Location">{(a) => <Input {...a} value={f.location} onChange={(e) => setF((x) => ({ ...x, location: e.target.value }))} placeholder="Room 12" />}</Field>
          <Field label="Classroom" className="sm:col-span-2">
            {(a) => (
              <Select value={f.section_id} onValueChange={(v) => setF((x) => ({ ...x, section_id: String(v), parent_viewable: v === "none" ? false : x.parent_viewable }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{f.section_id === "none" ? "Not a classroom" : sections.find((s) => s.id === f.section_id)?.label ?? camera?.section_label}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="none">Not a classroom</SelectItem>{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Stream link" className="sm:col-span-2" hint="https:// or rtsp://">{(a) => <Input {...a} value={f.stream_url} onChange={(e) => setF((x) => ({ ...x, stream_url: e.target.value }))} placeholder="https://nvr.school.in/live/12.m3u8" />}</Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.parent_viewable} disabled={f.section_id === "none"} onCheckedChange={(v) => setF((x) => ({ ...x, parent_viewable: v }))} />Families of this class may watch (with everyone&apos;s consent)</label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF((x) => ({ ...x, is_active: v }))} />Working</label>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="cam-form" disabled={f.name.trim().length < 2} loading={save.isPending}><Save aria-hidden />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CamerasTab() {
  const q = useCameras();
  const [editing, setEditing] = useState<Camera | null | undefined>(undefined);
  const watch = useMutation({
    mutationFn: (id: string) => api<{ stream_url: string }>(`/cctv/cameras/${id}/watch`, { method: "POST" }),
    onSuccess: ({ data }) => window.open(data.stream_url, "_blank", "noopener"),
    onError: (e) => toast.error(errText(e, "Can't open the camera")),
  });
  return (
    <>
      <div className="mb-3 flex"><Button className="ml-auto" onClick={() => setEditing(null)}><Plus aria-hidden />Add camera</Button></div>
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !q.data?.length ? <EmptyState className="rounded-2xl border bg-card" illustration={<Cctv className="size-12 text-muted-foreground/60" aria-hidden />} title="No cameras yet" /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((c) => (
            <li key={c.id} className={cn("rounded-xl border bg-card p-4", !c.is_active && "opacity-60")}>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{c.name}</p>
                {!c.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Not working</span>}
                <Button size="icon" variant="ghost" className="ml-auto" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil aria-hidden /></Button>
              </div>
              <p className="text-sm text-muted-foreground">{[c.location, c.section_label].filter(Boolean).join(" · ") || "—"}</p>
              {c.consent && (
                <p className="mt-2 text-sm">Consent: <span className="font-semibold">{c.consent.yes}</span> of {c.consent.students} yes{c.consent.no ? `, ${c.consent.no} no` : ""}
                  {c.parent_viewable && <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-semibold", c.consent.complete ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>{c.consent.complete ? "Families can watch" : "Not open to families"}</span>}
                </p>
              )}
              <Button size="sm" variant="outline" className="mt-3" disabled={!c.watchable} title={c.blocked_reason ?? undefined} onClick={() => watch.mutate(c.id)}><ExternalLink aria-hidden />Watch</Button>
            </li>
          ))}
        </ul>
      )}
      <CameraDialog camera={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />
    </>
  );
}

function ConsentTab() {
  const q = useConsentCoverage();
  if (q.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Consent by class</caption>
        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="px-4 py-2">Class</th><th scope="col" className="px-2 py-2 text-right">Students</th><th scope="col" className="px-2 py-2 text-right">Yes</th><th scope="col" className="px-2 py-2 text-right">No</th><th scope="col" className="px-2 py-2 text-right">No answer</th><th scope="col" className="w-48 px-4 py-2">Coverage</th></tr></thead>
        <tbody>
          {(q.data ?? []).map((c) => (
            <tr key={c.section_id} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{c.label}</td>
              <td className="px-2 py-2 text-right tabular">{c.students}</td>
              <td className="px-2 py-2 text-right tabular text-success">{c.yes}</td>
              <td className="px-2 py-2 text-right tabular text-destructive">{c.no}</td>
              <td className="px-2 py-2 text-right tabular text-muted-foreground">{c.unanswered}</td>
              <td className="px-4 py-2"><span className="block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-success" style={{ width: `${c.students ? (100 * c.yes) / c.students : 0}%` }} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyTab() {
  const qc = useQueryClient();
  const q = useCctvSettings();
  const views = useCctvViews();
  const [f, setF] = useState<CctvSettings | null>(null);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api("/cctv/settings", { method: "PUT", body: f }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cctv"] }); toast.success("Saved"); },
  });
  if (!f) return <Skeleton className="h-48" />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form className="rounded-2xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="CCTV policy shown to families">{(a) => <Textarea {...a} rows={7} value={f.policy} onChange={(e) => setF({ ...f, policy: e.target.value })} />}</Field>
        <label className="mt-4 flex items-center gap-2 text-sm"><Switch checked={f.parent_viewing} onCheckedChange={(v) => setF({ ...f, parent_viewing: v })} />Let families watch their child&apos;s classroom live</label>
        <Button type="submit" className="mt-4" loading={save.isPending}><Save aria-hidden />Save</Button>
      </form>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Who watched</h2>
        {!views.data?.length ? <p className="text-sm text-muted-foreground">No one has opened a camera yet.</p> : (
          <ul className="divide-y text-sm">{views.data.map((v, i) => <li key={i} className="flex justify-between gap-2 py-2"><span>{v.user ?? "—"} <span className="text-muted-foreground">· {v.role ? roleLabel(v.role) : ""} · {v.camera}</span></span><span className="text-muted-foreground">{format(parseISO(v.at), "d MMM, h:mm a")}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}

function CctvPage() {
  const [tab, setTab] = useState("cameras");
  return (
    <>
      <PageHeader title="CCTV" description="Cameras, family consent for classroom cameras, and a record of who watched." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-5">
        <TabsList><TabsTrigger value="cameras">Cameras</TabsTrigger><TabsTrigger value="consent">Consent</TabsTrigger><TabsTrigger value="policy">Policy and log</TabsTrigger></TabsList>
      </Tabs>
      {tab === "cameras" && <CamerasTab />}
      {tab === "consent" && <ConsentTab />}
      {tab === "policy" && <PolicyTab />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="cctv.manage"><CctvPage /></PermissionGate>;
}
