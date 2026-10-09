"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, FileCheck2, Paperclip, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { FileList } from "@/components/common/files";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { ComplianceDoc } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { useComplianceDocs } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const STATE: Record<ComplianceDoc["state"], { label: string; tone: string }> = {
  expired: { label: "Expired", tone: "bg-destructive/10 text-destructive" },
  expiring: { label: "Renew soon", tone: "bg-warning/10 text-warning" },
  valid: { label: "Valid", tone: "bg-success/10 text-success" },
  no_expiry: { label: "No expiry", tone: "bg-muted text-muted-foreground" },
};
const SUGGESTIONS = ["Fire safety", "Building safety", "Affiliation", "Health", "Transport", "Child protection", "Land and lease", "Tax"];

function DocDialog({ doc, open, onOpenChange }: { doc: ComplianceDoc | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const empty = { title: "", category: "", reference_no: "", authority: "", issued_on: "", expires_on: "", notes: "" };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setF(doc ? Object.fromEntries(Object.keys(empty).map((k) => [k, (doc[k as keyof ComplianceDoc] as string | null) ?? ""])) as typeof empty : empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc]);
  const save = useMutation({
    mutationFn: () => api(doc ? `/compliance/${doc.id}` : "/compliance", { method: doc ? "PUT" : "POST", body: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance"] }); toast.success(doc ? "Updated" : "Added. Attach the certificate next."); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{doc ? doc.title : "Add a document"}</DialogTitle><DialogDescription>The admins are reminded 30 days before it expires.</DialogDescription></DialogHeader>
        <form id="doc-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Title" required className="sm:col-span-2">{(a) => <Input {...a} value={f.title} onChange={set("title")} placeholder="e.g. Fire NOC" />}</Field>
          <Field label="Category" required>{(a) => <><Input {...a} value={f.category} onChange={set("category")} list="compliance-cats" /><datalist id="compliance-cats">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist></>}</Field>
          <Field label="Reference no.">{(a) => <Input {...a} value={f.reference_no} onChange={set("reference_no")} />}</Field>
          <Field label="Issued by" className="sm:col-span-2">{(a) => <Input {...a} value={f.authority} onChange={set("authority")} placeholder="e.g. Chandigarh Fire Department" />}</Field>
          <Field label="Issued on">{(a) => <Input {...a} type="date" value={f.issued_on} onChange={set("issued_on")} />}</Field>
          <Field label="Expires on">{(a) => <Input {...a} type="date" value={f.expires_on} onChange={set("expires_on")} />}</Field>
          <Field label="Notes" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={f.notes} onChange={set("notes")} />}</Field>
        </form>
        {doc && <div><p className="mb-2 text-sm font-medium">Scans and certificates</p><FileList purpose="compliance_doc" ownerId={doc.id} canUpload compact emptyText="Nothing attached" onChanged={() => qc.invalidateQueries({ queryKey: ["compliance"] })} /></div>}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="submit" form="doc-form" disabled={f.title.trim().length < 2 || f.category.trim().length < 2} loading={save.isPending}><Save aria-hidden />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompliancePage() {
  const qc = useQueryClient();
  const can = useCan();
  const manage = can("compliance.manage");
  const q = useComplianceDocs();
  const [editing, setEditing] = useState<ComplianceDoc | null | undefined>(undefined);
  const [removing, setRemoving] = useState<ComplianceDoc | null>(null);
  const [viewing, setViewing] = useState<ComplianceDoc | null>(null);
  const remind = useMutation({
    mutationFn: () => api<{ message: string }>("/compliance/remind", { method: "POST" }),
    onSuccess: ({ data }) => toast.success(data.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/compliance/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance"] }); toast.success("Removed"); setRemoving(null); },
  });
  const due = (q.data ?? []).filter((d) => d.state === "expired" || d.state === "expiring").length;
  return (
    <>
      <PageHeader title="Compliance vault" description="Certificates and approvals the school must keep current, with their scans and expiry dates."
        actions={manage && <><Button variant="outline" onClick={() => remind.mutate()} loading={remind.isPending}><BellRing aria-hidden />Remind now</Button><Button onClick={() => setEditing(null)}><Plus aria-hidden />Add document</Button></>} />
      {due > 0 && <p role="status" className="mb-4 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm"><span className="font-semibold">{due} document{due === 1 ? "" : "s"}</span> expired or due for renewal within 30 days.</p>}
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<FileCheck2 className="size-12 text-muted-foreground/60" aria-hidden />} title="Nothing in the vault yet" description="Add the fire NOC, building safety certificate, affiliation and the rest." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Compliance documents</caption>
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="px-4 py-2">Document</th><th scope="col" className="px-2 py-2">Category</th><th scope="col" className="px-2 py-2">Expires</th><th scope="col" className="px-2 py-2">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {q.data.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2"><span className="font-medium">{d.title}</span><span className="block text-xs text-muted-foreground">{[d.authority, d.reference_no].filter(Boolean).join(" · ") || "—"}</span></td>
                  <td className="px-2 py-2">{d.category}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{d.expires_on ? formatDate(d.expires_on) : "—"}{d.days_left != null && d.days_left >= 0 && d.days_left <= 30 && <span className="block text-xs text-warning">{d.days_left} days left</span>}</td>
                  <td className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATE[d.state].tone)}>{STATE[d.state].label}</span></td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(d)}><Paperclip aria-hidden />{d.files}</Button>
                      {manage && <Button size="icon" variant="ghost" aria-label={`Edit ${d.title}`} onClick={() => setEditing(d)}><Pencil aria-hidden /></Button>}
                      {manage && <Button size="icon" variant="ghost" aria-label={`Remove ${d.title}`} onClick={() => setRemoving(d)}><Trash2 aria-hidden /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {manage && <DocDialog doc={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />}
      <Dialog open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle><DialogDescription>Attached scans</DialogDescription></DialogHeader>
          {viewing && <FileList purpose="compliance_doc" ownerId={viewing.id} canUpload={manage} compact emptyText="Nothing attached" onChanged={() => qc.invalidateQueries({ queryKey: ["compliance"] })} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)} title={`Remove ${removing?.title}?`}
        description="The document and its scans are deleted." confirmLabel="Remove" destructive pending={del.isPending} onConfirm={() => removing && del.mutate(removing.id)} />
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="compliance.view"><CompliancePage /></PermissionGate>;
}
