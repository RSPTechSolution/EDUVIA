"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatusBadge } from "@/components/common/status-badge";
import { UsageBar } from "@/components/common/usage-bar";
import { CustomBuilder, type CustomSelection } from "@/components/pricing/custom-builder";
import { CycleToggle, PlanCards, planPrice } from "@/components/pricing/plan-cards";
import { useCan } from "@/components/session-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api/client";
import type { BillingCycle, Plan } from "@/lib/api/types";
import { formatDate, inr } from "@/lib/format";
import { usePricingCatalog, useSubscription } from "@/lib/queries";

type Target = { code: string; name: string; custom?: CustomSelection; monthly: number };

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  trialing: { label: "Free trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment due", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

function BillingPage() {
  const can = useCan();
  const manage = can("billing.manage");
  const sub = useSubscription();
  const catalog = usePricingCatalog();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  const change = useMutation({
    mutationFn: (t: Target) =>
      api<{ changed: boolean; message: string }>("/subscription/change", {
        method: "POST",
        body: {
          plan_code: t.code,
          billing_cycle: cycle ?? sub.data?.billing_cycle ?? "yearly",
          ...(t.custom ? { custom_modules: t.custom.modules, custom_students: t.custom.students } : {}),
        },
      }),
    onSuccess: ({ data }) => {
      setTarget(null);
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["school"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.refresh(); // sidebar modules depend on the plan
      toast.success(data.changed ? "Plan updated" : "Request sent", { description: data.message });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not change the plan"),
  });

  if (sub.isLoading || !sub.data) {
    return (
      <>
        <PageHeader title="Plan & billing" />
        <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      </>
    );
  }

  const s = sub.data;
  const activeCycle = cycle ?? s.billing_cycle;
  const status = STATUS_LABEL[s.status] ?? { label: s.status, tone: "info" as const };
  const labels = Object.fromEntries((catalog.data?.modules ?? []).map((m) => [m.module, m.label]));
  const price = planPrice(s.plan, s.billing_cycle);
  const verb = s.can_self_change ? "Switch" : "Request";

  return (
    <>
      <PageHeader title="Plan & billing" description="Your subscription, usage and what each plan includes." />

      {s.status === "trialing" && !s.trial_expired && (
        <Alert className="mb-6 border-info/30 bg-info/5">
          <CalendarClock className="text-info" aria-hidden />
          <AlertTitle>{s.trial_days_left} {s.trial_days_left === 1 ? "day" : "days"} left in your free trial</AlertTitle>
          <AlertDescription>Your trial ends on {formatDate(s.trial_ends_at)}. You can switch plans freely until then.</AlertDescription>
        </Alert>
      )}
      {s.trial_expired && (
        <Alert className="mb-6 border-warning/40 bg-warning/5">
          <CalendarClock className="text-warning" aria-hidden />
          <AlertTitle>Your free trial has ended</AlertTitle>
          <AlertDescription>Choose a plan below and our team will contact you to activate it. Your data is safe.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Current plan</p>
              <StatusBadge tone={status.tone} label={status.label} />
            </div>
            <p className="font-heading text-3xl font-extrabold">{s.plan.name}</p>
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground tabular">{price.headline}</span>{price.unit} · + GST</p>
            {s.current_period_end && <p className="pt-2 text-xs text-muted-foreground">Renews on {formatDate(s.current_period_end)}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-6 sm:grid-cols-3">
            <UsageBar label="Students" used={s.usage.students} limit={s.plan.max_students} />
            <UsageBar label="Staff accounts" used={s.usage.staff} limit={s.plan.max_staff} />
            <div>
              <p className="text-sm font-medium">Modules</p>
              <p className="mt-1 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{s.plan.modules.length}</span> of {Object.keys(labels).length || 16} included</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.plan.storage_gb} GB storage</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Change plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.can_self_change ? "During your trial, changes apply immediately." : "Pick a plan and our team will contact you to complete the change."}
          </p>
        </div>
        <CycleToggle value={activeCycle} onChange={setCycle} />
      </div>

      <Tabs defaultValue="plans" className="mt-6">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="custom">Custom plan</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-6">
          <PlanCards
            plans={s.available_plans}
            cycle={activeCycle}
            currentCode={s.plan.code}
            moduleLabels={labels}
            renderCta={(p: Plan) =>
              p.code === s.plan.code ? (
                <Button variant="outline" size="lg" className="h-11 w-full" disabled><CheckCircle2 aria-hidden />Your current plan</Button>
              ) : (
                <Button
                  size="lg"
                  variant={p.highlight ? "default" : "outline"}
                  className="h-11 w-full"
                  disabled={!manage}
                  onClick={() => setTarget({ code: p.code, name: p.name, monthly: p.price_monthly })}
                >
                  {verb} to {p.name}
                </Button>
              )
            }
          />
          {!manage && <p className="mt-4 text-sm text-muted-foreground">Only school admins can change the plan.</p>}
        </TabsContent>
        <TabsContent value="custom" className="mt-6">
          {catalog.data && (
            <CustomBuilder
              catalog={catalog.data}
              cycle={activeCycle}
              initial={{ modules: s.plan.modules, students: Math.max(catalog.data.min_students, s.plan.max_students ?? 500) }}
              renderCta={(sel, quote) => (
                <Button
                  size="lg"
                  className="h-11 w-full"
                  disabled={!manage || !quote}
                  onClick={() => quote && setTarget({ code: "custom", name: "a custom plan", custom: sel, monthly: quote.monthly })}
                >
                  <Sparkles aria-hidden />{verb} to this plan
                </Button>
              )}
            />
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        pending={change.isPending}
        title={s.can_self_change ? `Switch to ${target?.name}?` : `Request ${target?.name}?`}
        description={
          s.can_self_change
            ? `Your school moves to ${target?.name} now (${inr(target?.monthly ?? 0)}/month after the trial, + GST). Modules not in the new plan will be switched off.`
            : `We'll send your request to the Vidyanexa team, who will contact you to complete the change.`
        }
        confirmLabel={s.can_self_change ? "Switch plan" : "Send request"}
        onConfirm={() => target && change.mutate(target)}
      />
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="billing.view">
      <BillingPage />
    </PermissionGate>
  );
}
