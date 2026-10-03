"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Blocks, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import type { ModuleState } from "@/lib/api/types";
import { modulesReviewed } from "@/lib/local-flags";
import { MODULE_META } from "@/lib/module-meta";
import { qk, useModules } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ModulesPage() {
  const modules = useModules();
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => modulesReviewed.set(), []);

  const toggle = useMutation({
    mutationFn: ({ module, is_enabled }: { module: string; is_enabled: boolean }) =>
      api<ModuleState>(`/schools/current/modules/${module}`, { method: "PUT", body: { is_enabled } }),
    onMutate: async ({ module, is_enabled }) => {
      await queryClient.cancelQueries({ queryKey: qk.modules });
      const previous = queryClient.getQueryData<ModuleState[]>(qk.modules);
      queryClient.setQueryData<ModuleState[]>(qk.modules, (old) => old?.map((m) => (m.module === module ? { ...m, is_enabled } : m)));
      return { previous };
    },
    onError: (e, _v, ctx) => {
      queryClient.setQueryData(qk.modules, ctx?.previous);
      toast.error(e instanceof ApiError ? e.message : "Could not update the module");
    },
    onSuccess: ({ data }) => {
      toast.success(`${data.label} ${data.is_enabled ? "enabled" : "disabled"}`);
      router.refresh(); // sidebar visibility depends on enabled modules
    },
  });

  const enabledCount = modules.data?.filter((m) => m.is_enabled).length ?? 0;
  const inPlanCount = modules.data?.filter((m) => m.in_plan).length ?? 0;

  return (
    <>
      <PageHeader
        title="Modules"
        description={modules.data ? `${enabledCount} on · ${inPlanCount} of ${modules.data.length} included in your plan. Modules that are off disappear from menus and their pages are blocked.` : "Choose the features your school uses."}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.isLoading
          ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : modules.data?.map((m) => {
              const meta = MODULE_META[m.module] ?? { icon: Blocks, description: "" };
              const Icon = meta.icon;
              const id = `module-${m.module}`;
              return (
                <div key={m.module} className={cn("flex gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors", m.is_enabled && "border-primary/30", !m.in_plan && "bg-muted/30")}>
                  <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", m.is_enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <label htmlFor={id} className={cn("font-medium", !m.in_plan && "text-muted-foreground")}>{m.label}</label>
                      {m.in_plan ? (
                        <Switch
                          id={id}
                          checked={m.is_enabled}
                          disabled={toggle.isPending && toggle.variables?.module === m.module}
                          onCheckedChange={(checked) => toggle.mutate({ module: m.module, is_enabled: checked })}
                        />
                      ) : (
                        <Switch id={id} checked={false} disabled aria-describedby={`${id}-lock`} />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
                    {!m.in_plan && (
                      <p id={`${id}-lock`} className="mt-2.5 flex items-center gap-1.5 text-xs font-medium">
                        <Lock className="size-3.5 text-muted-foreground" aria-hidden />
                        <span className="text-muted-foreground">Not in your plan.</span>
                        <Link href="/settings/billing" className="text-primary hover:underline">
                          {m.upgrade_plan ? `Available on ${m.upgrade_plan}` : "See plans"}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="modules.manage">
      <ModulesPage />
    </PermissionGate>
  );
}
