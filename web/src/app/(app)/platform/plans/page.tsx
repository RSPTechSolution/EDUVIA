"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatusBadge } from "@/components/common/status-badge";
import { limitText } from "@/components/pricing/plan-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { Plan } from "@/lib/api/types";
import { inr } from "@/lib/format";
import { usePricingCatalog } from "@/lib/queries";

interface Draft {
  name: string; tagline: string; price_monthly: string; price_yearly: string;
  max_students: string; max_staff: string; storage_gb: string; modules: string[]; features: string;
  highlight: boolean; is_active: boolean;
}

const toDraft = (p: Plan): Draft => ({
  name: p.name, tagline: p.tagline ?? "", price_monthly: String(p.price_monthly), price_yearly: String(p.price_yearly),
  max_students: p.max_students === null ? "" : String(p.max_students), max_staff: p.max_staff === null ? "" : String(p.max_staff),
  storage_gb: String(p.storage_gb), modules: p.modules, features: p.features.join("\n"), highlight: p.highlight, is_active: p.is_active,
});

function PlanEditor({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const catalog = usePricingCatalog();
  const queryClient = useQueryClient();
  const [d, setD] = useState<Draft | null>(null);
  useEffect(() => setD(plan ? toDraft(plan) : null), [plan]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));

  const save = useMutation({
    mutationFn: (x: Draft) => api<Plan>(`/platform/plans/${plan!.id}`, {
      method: "PATCH",
      body: {
        name: x.name, tagline: x.tagline || null, price_monthly: Number(x.price_monthly), price_yearly: Number(x.price_yearly),
        storage_gb: Number(x.storage_gb), modules: x.modules, highlight: x.highlight, is_active: x.is_active,
        features: x.features.split("\n").map((f) => f.trim()).filter(Boolean),
        ...(x.max_students ? { max_students: Number(x.max_students) } : { unlimited_students: true }),
        ...(x.max_staff ? { max_staff: Number(x.max_staff) } : { unlimited_staff: true }),
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "plans"] });
      queryClient.invalidateQueries({ queryKey: ["public"] });
      toast.success("Plan saved", { description: "The website shows the new details within 5 minutes." });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not save the plan"),
  });

  const num = (v: string) => /^\d*$/.test(v);
  const valid = d && d.name.trim().length >= 2 && d.price_monthly !== "" && d.price_yearly !== "" && d.storage_gb !== "";

  return (
    <Sheet open={Boolean(plan)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit {plan?.name}</SheetTitle>
          <SheetDescription>Changes apply to every school on this plan, and to the website.</SheetDescription>
        </SheetHeader>
        {d && (
          <div className="grid gap-4 px-4 sm:grid-cols-2">
            <Field label="Name" required>{(a) => <Input {...a} value={d.name} onChange={(e) => set("name", e.target.value)} />}</Field>
            <Field label="Storage (GB)" required>{(a) => <Input {...a} inputMode="numeric" value={d.storage_gb} onChange={(e) => num(e.target.value) && set("storage_gb", e.target.value)} />}</Field>
            <Field label="Tagline" className="sm:col-span-2">{(a) => <Input {...a} value={d.tagline} onChange={(e) => set("tagline", e.target.value)} />}</Field>
            <Field label="Monthly price (₹)" required>{(a) => <Input {...a} inputMode="numeric" value={d.price_monthly} onChange={(e) => num(e.target.value) && set("price_monthly", e.target.value)} />}</Field>
            <Field label="Yearly price (₹)" required>{(a) => <Input {...a} inputMode="numeric" value={d.price_yearly} onChange={(e) => num(e.target.value) && set("price_yearly", e.target.value)} />}</Field>
            <Field label="Max students" hint="Leave blank for unlimited.">{(a) => <Input {...a} inputMode="numeric" value={d.max_students} onChange={(e) => num(e.target.value) && set("max_students", e.target.value)} />}</Field>
            <Field label="Max staff" hint="Leave blank for unlimited.">{(a) => <Input {...a} inputMode="numeric" value={d.max_staff} onChange={(e) => num(e.target.value) && set("max_staff", e.target.value)} />}</Field>
            <Field label="Features (one per line)" className="sm:col-span-2">{(a) => <Textarea {...a} rows={6} value={d.features} onChange={(e) => set("features", e.target.value)} />}</Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Modules</legend>
              <div className="grid grid-cols-2 gap-2">
                {catalog.data?.modules.map((m) => (
                  <label key={m.module} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={m.core || d.modules.includes(m.module)}
                      disabled={m.core}
                      onCheckedChange={(c) => set("modules", c ? [...d.modules, m.module] : d.modules.filter((x) => x !== m.module))}
                    />
                    {m.label}{m.core && <span className="text-xs text-muted-foreground">(core)</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center justify-between gap-3 text-sm font-medium sm:col-span-2">
              Show as &ldquo;Most popular&rdquo;<Switch checked={d.highlight} onCheckedChange={(v) => set("highlight", v)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-medium sm:col-span-2">
              Available to new schools<Switch checked={d.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </label>
          </div>
        )}
        <SheetFooter>
          <Button onClick={() => d && save.mutate(d)} disabled={!valid} loading={save.isPending} loadingText="Saving…">
            Save plan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PlansPage() {
  const plans = useQuery({ queryKey: ["platform", "plans"], queryFn: async () => (await api<Plan[]>("/platform/plans")).data });
  const [editing, setEditing] = useState<Plan | null>(null);
  return (
    <>
      <PageHeader title="Plans" description="Prices, limits and modules for each plan. Shown on the pricing page and enforced for every school." />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        {plans.data?.map((p) => (
          <Card key={p.id} className={p.highlight ? "border-primary/40" : undefined}>
            <CardContent>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-heading text-xl font-bold">{p.name}{p.highlight && <Sparkles className="size-4 text-primary" aria-label="Most popular" />}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                </div>
                <StatusBadge status={p.is_active ? "active" : "inactive"} />
              </div>
              <p className="mt-4"><span className="font-heading text-2xl font-semibold tabular">{inr(p.price_monthly)}</span><span className="text-sm text-muted-foreground">/month · {inr(p.price_yearly)}/year</span></p>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                <li>{limitText(p.max_students, "students")}</li>
                <li>{limitText(p.max_staff, "staff accounts")}</li>
                <li>{p.storage_gb} GB storage · {p.modules.length} modules</li>
              </ul>
              <Button variant="outline" className="mt-5 w-full" onClick={() => setEditing(p)}><Pencil aria-hidden />Edit plan</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <PlanEditor plan={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate superAdmin>
      <PlansPage />
    </PermissionGate>
  );
}
