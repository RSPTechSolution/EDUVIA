"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { ArrowLeft, FilePlus2, Pencil, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { LateFeeCard } from "@/components/fees/collection-tools";
import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import type { FeeCategory, StructureMatrix } from "@/lib/api/types";
import { inr } from "@/lib/format";
import { useFeeStructures } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errorText = (e: unknown, fallback: string) => e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : fallback;

function CategoryDialog({ open, onOpenChange, category }: { open: boolean; onOpenChange: (o: boolean) => void; category: FeeCategory | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setName(category?.name ?? ""); setDescription(category?.description ?? ""); setActive(category?.is_active ?? true); setError(null); }
  }, [open, category]);
  const save = useMutation({
    mutationFn: () => api(category ? `/fees/categories/${category.id}` : "/fees/categories", {
      method: category ? "PATCH" : "POST", body: { name, description: description || null, is_active: active },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fees"] }); onOpenChange(false); toast.success(category ? "Category updated" : "Category added"); },
    onError: (e) => setError(errorText(e, "Could not save")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{category ? "Edit fee category" : "Add a fee category"}</DialogTitle><DialogDescription>e.g. Tuition, Transport, Lab fee.</DialogDescription></DialogHeader>
        <form id="cat-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required error={error ?? undefined}>{(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}</Field>
          <Field label="Description">{(a) => <Input {...a} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />}</Field>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>Active<span className="block text-xs text-muted-foreground">Inactive categories aren&apos;t added to new invoices.</span></span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="cat-form" disabled={!name.trim()} loading={save.isPending} loadingText="Saving…">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateDialog({ open, onOpenChange, matrix }: { open: boolean; onOpenChange: (o: boolean) => void; matrix: StructureMatrix }) {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [due, setDue] = useState(format(addDays(new Date(), 14), "yyyy-MM-dd"));
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setClassIds(new Set(matrix.classes.filter((c) => c.total > 0).map((c) => c.class_id))); setError(null); }
  }, [open, matrix]);
  const chosen = matrix.classes.filter((c) => classIds.has(c.class_id));
  const estimate = chosen.reduce((n, c) => n + c.total * c.students, 0);
  const run = useMutation({
    mutationFn: () => api<{ created: number; skipped_existing: number; skipped_zero: number; total_billed: number }>("/fees/invoices/generate", {
      method: "POST", body: { term, due_date: due, class_ids: [...classIds] },
    }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["fees"] });
      onOpenChange(false);
      toast.success(`${data.created} invoices created · ${inr(data.total_billed)}`, {
        description: data.skipped_existing ? `${data.skipped_existing} students already had an invoice for this term.` : undefined,
      });
    },
    onError: (e) => setError(errorText(e, "Could not create invoices")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate invoices</DialogTitle>
          <DialogDescription>One invoice per active student, using each class&apos;s fees. Students who already have this term are skipped.</DialogDescription>
        </DialogHeader>
        <form id="gen-form" className="grid gap-4 sm:grid-cols-[1fr_11rem]" onSubmit={(e) => { e.preventDefault(); run.mutate(); }}>
          <Field label="Term" required error={error ?? undefined}>{(a) => <Input {...a} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Quarter 4 (Jan–Mar) 2026-27" maxLength={100} />}</Field>
          <Field label="Due date" required>{(a) => <Input {...a} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
              Classes
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setClassIds(new Set(classIds.size === matrix.classes.length ? [] : matrix.classes.map((c) => c.class_id)))}>
                {classIds.size === matrix.classes.length ? "Clear" : "Select all"}
              </button>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {matrix.classes.map((c) => {
                const on = classIds.has(c.class_id);
                return (
                  <button key={c.class_id} type="button" aria-pressed={on} disabled={!c.total}
                    onClick={() => setClassIds((s) => { const n = new Set(s); if (on) n.delete(c.class_id); else n.add(c.class_id); return n; })}
                    className={cn("rounded-full border px-3 py-1 text-sm transition disabled:opacity-40", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    {c.class_name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </form>
        <p className="rounded-lg bg-muted/50 p-3 text-sm">About <span className="font-semibold tabular">{chosen.reduce((n, c) => n + c.students, 0)}</span> invoices totalling <span className="font-semibold tabular">{inr(estimate)}</span></p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="gen-form" disabled={term.trim().length < 2 || !classIds.size} loading={run.isPending} loadingText="Creating invoices…"><FilePlus2 aria-hidden />Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClassRow({ row, categories }: { row: StructureMatrix["classes"][number]; categories: FeeCategory[] }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => setValues(Object.fromEntries(categories.map((c) => [c.id, row.amounts[c.id] ? String(row.amounts[c.id]) : ""]))), [row, categories]);
  const dirty = categories.some((c) => (values[c.id] || "") !== (row.amounts[c.id] ? String(row.amounts[c.id]) : ""));
  const total = categories.filter((c) => c.is_active).reduce((n, c) => n + Number(values[c.id] || 0), 0);
  const save = useMutation({
    mutationFn: () => api("/fees/structures", { method: "PUT", body: { class_id: row.class_id, items: categories.map((c) => ({ category_id: c.id, amount: Number(values[c.id] || 0) })) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fees", "structures"] }); toast.success(`Fees saved for ${row.class_name}`); },
    onError: (e) => toast.error(errorText(e, "Could not save")),
  });
  return (
    <tr className={cn("hover:bg-muted/30", dirty && "bg-primary/[0.04]")}>
      <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left font-medium">{row.class_name}<span className="block text-xs font-normal text-muted-foreground">{row.students} students</span></th>
      {categories.map((c) => (
        <td key={c.id} className="px-1.5 py-2">
          <Input type="number" min={0} step="100" inputMode="numeric" value={values[c.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
            aria-label={`${c.name} for ${row.class_name}`} placeholder="0" className={cn("h-8 w-28 text-right tabular", !c.is_active && "opacity-50")} />
        </td>
      ))}
      <td className="px-3 py-2 text-right font-semibold tabular">{inr(total)}</td>
      <td className="px-2 py-2">
        <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty} onClick={() => save.mutate()} loading={save.isPending} loadingText="" aria-label={`Save ${row.class_name}`}><Save aria-hidden /></Button>
      </td>
    </tr>
  );
}

export default function Page() {
  const m = useFeeStructures();
  const [cat, setCat] = useState<{ open: boolean; category: FeeCategory | null }>({ open: false, category: null });
  const [generating, setGenerating] = useState(false);
  return (
    <PermissionGate permission="fees.manage">
      <Link href="/fees" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Fees</Link>
      <PageHeader title="Fee setup" description="What each class pays per term, and billing a new term."
        actions={m.data && <Button onClick={() => setGenerating(true)}><FilePlus2 aria-hidden />Generate invoices</Button>} />
      {!m.data ? <Skeleton className="h-96 rounded-xl" /> : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div><CardTitle>Fee categories</CardTitle><CardDescription>The charges that appear on invoices</CardDescription></div>
              <Button variant="outline" size="sm" onClick={() => setCat({ open: true, category: null })}><Plus aria-hidden />Category</Button>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {m.data.categories.map((c) => (
                <button key={c.id} type="button" onClick={() => setCat({ open: true, category: c })}
                  className={cn("card-lift group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm", !c.is_active && "opacity-60")}>
                  <span><span className="block font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.is_active ? c.description ?? "Active" : "Inactive"}</span></span>
                  <Pencil className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden />
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Fees per term by class</CardTitle><CardDescription>Edit a row and save it. Leave a box empty for no charge. Changes apply to invoices you generate next.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Fee per term for each class and category</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="sticky left-0 bg-card px-3 py-2 text-left font-semibold">Class</th>
                    {m.data.categories.map((c) => <th key={c.id} scope="col" className="px-1.5 py-2 text-right font-semibold">{c.name}</th>)}
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Per term</th>
                    <th scope="col"><span className="sr-only">Save</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">{m.data.classes.map((r) => <ClassRow key={r.class_id} row={r} categories={m.data!.categories} />)}</tbody>
              </table>
            </CardContent>
          </Card>
          <LateFeeCard />
          <GenerateDialog open={generating} onOpenChange={setGenerating} matrix={m.data} />
        </div>
      )}
      <CategoryDialog open={cat.open} category={cat.category} onOpenChange={(o) => setCat((x) => ({ ...x, open: o }))} />
    </PermissionGate>
  );
}
