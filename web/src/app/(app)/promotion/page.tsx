"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, GraduationCap, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import type { PromotionAction } from "@/lib/api/types";
import { useClasses, usePromotion } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ACTIONS: Record<PromotionAction, string> = { promote: "Promote", repeat: "Keep in class", leave: "Leaving school", graduate: "Graduate" };

export default function PromotionPage() {
  const qc = useQueryClient();
  const classes = useClasses();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const q = usePromotion(sectionId);
  const [plan, setPlan] = useState<Record<string, { action: PromotionAction; to: string | null }>>({});
  const [resetRolls, setResetRolls] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const sections = useMemo(() => [...(classes.data ?? [])].sort((a, b) => b.sort_order - a.sort_order)
    .flatMap((c) => c.sections.map((s) => ({ id: s.id, label: `${c.name} – ${s.name}`, n: s.student_count }))), [classes.data]);
  const p = q.data;
  useEffect(() => {
    if (!p) return;
    setPlan(Object.fromEntries(p.students.map((s) => [s.student_id, { action: s.suggested, to: s.suggested === "promote" ? p.default_section_id : null }])));
  }, [p]);
  const counts = useMemo(() => Object.values(plan).reduce((acc, v) => ({ ...acc, [v.action]: (acc[v.action] ?? 0) + 1 }), {} as Record<string, number>), [plan]);

  const run = useMutation({
    mutationFn: () => api<{ promoted: number; repeated: number; left: number; graduated: number }>("/promotion", {
      method: "POST",
      body: { section_id: sectionId, reset_roll_numbers: resetRolls, items: Object.entries(plan).map(([student_id, v]) => ({ student_id, action: v.action, to_section_id: v.action === "promote" ? v.to : null })) },
    }),
    onSuccess: ({ data }) => {
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ["promotion"] }); qc.invalidateQueries({ queryKey: ["classes"] }); qc.invalidateQueries({ queryKey: ["students"] });
      const bits = [data.promoted && `${data.promoted} promoted`, data.repeated && `${data.repeated} kept back`, data.left && `${data.left} left`, data.graduated && `${data.graduated} graduated`].filter(Boolean);
      toast.success(`Done: ${bits.join(", ")}`);
    },
    onError: (e) => { setConfirming(false); toast.error(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not promote"); },
  });

  const missingTarget = p && Object.values(plan).some((v) => v.action === "promote" && !v.to);
  return (
    <PermissionGate permission="students.promote">
      <PageHeader title="Promote students" description="At the end of the year, move each class up. Suggestions come from the latest published exam." />
      <Alert className="mb-5"><Info aria-hidden /><AlertDescription>Start with the senior-most class (it graduates first), then work down, so every class has room when the one below moves up.</AlertDescription></Alert>
      <Field label="Class" className="mb-5 w-72">
        {(a) => (
          <Select value={sectionId ?? undefined} onValueChange={(v) => setSectionId(String(v))}>
            <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Choose a section">{sections.find((s) => s.id === sectionId)?.label}</SelectValue></SelectTrigger>
            <SelectContent className="max-h-80">{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} ({s.n})</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Field>
      {!sectionId ? <EmptyState className="rounded-2xl border bg-card" title="Choose a class to promote" /> : q.isLoading || !p ? <Skeleton className="h-72 rounded-xl" /> : p.students.length === 0 ? (
        <EmptyState className="rounded-2xl border bg-card" title="No active students in this section" />
      ) : (
        <div className="rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <p className="flex items-center gap-2 font-semibold">{p.section_label}<ArrowRight className="size-4 text-muted-foreground" aria-hidden />{p.next_class_name ?? "Graduation"}</p>
            <div className="ml-auto flex flex-wrap gap-2 text-xs">
              {(Object.keys(ACTIONS) as PromotionAction[]).filter((k) => counts[k]).map((k) => <span key={k} className="rounded-full bg-muted px-2.5 py-1 font-medium">{counts[k]} · {ACTIONS[k]}</span>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">Student</th><th scope="col" className="px-2 py-2 font-medium">Result</th>
                <th scope="col" className="px-2 py-2 font-medium">Action</th>{p.next_class_id && <th scope="col" className="px-2 py-2 font-medium">To section</th>}
              </tr></thead>
              <tbody>
                {p.students.map((s) => {
                  const v = plan[s.student_id];
                  if (!v) return null;
                  const actions: PromotionAction[] = p.next_class_id ? ["promote", "repeat", "leave"] : ["graduate", "repeat", "leave"];
                  return (
                    <tr key={s.student_id} className="border-b last:border-0">
                      <td className="px-4 py-2"><span className="font-medium">{s.name}</span><span className="block text-xs text-muted-foreground">{s.admission_no}{s.roll_no ? ` · Roll ${s.roll_no}` : ""}</span></td>
                      <td className="px-2 py-2">
                        {s.percent == null ? <span className="text-xs text-muted-foreground">No result</span> : (
                          <span className={cn("text-xs font-semibold", s.passed ? "text-success" : "text-destructive")}>{s.percent}% · {s.passed ? "Pass" : "Fail"}<span className="block font-normal text-muted-foreground">{s.exam}</span></span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Select value={v.action} onValueChange={(a) => setPlan((x) => ({ ...x, [s.student_id]: { action: a as PromotionAction, to: a === "promote" ? (v.to ?? p.default_section_id) : null } }))}>
                          <SelectTrigger className="h-8 w-40" aria-label={`What happens to ${s.name}`}><SelectValue>{ACTIONS[v.action]}</SelectValue></SelectTrigger>
                          <SelectContent>{actions.map((a) => <SelectItem key={a} value={a}>{ACTIONS[a]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      {p.next_class_id && (
                        <td className="px-2 py-2">
                          {v.action === "promote" ? (
                            <Select value={v.to ?? undefined} onValueChange={(t) => setPlan((x) => ({ ...x, [s.student_id]: { ...v, to: String(t) } }))}>
                              <SelectTrigger className="h-8 w-44" aria-label={`Section for ${s.name}`}><SelectValue placeholder="Choose">{p.next_sections.find((n) => n.id === v.to)?.name && `${p.next_class_name} – ${p.next_sections.find((n) => n.id === v.to)?.name}`}</SelectValue></SelectTrigger>
                              <SelectContent>{p.next_sections.map((n) => <SelectItem key={n.id} value={n.id}>{p.next_class_name} – {n.name} ({n.students}{n.capacity ? `/${n.capacity}` : ""})</SelectItem>)}</SelectContent>
                            </Select>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t p-4">
            <label className="flex items-center gap-2 text-sm"><Switch checked={resetRolls} onCheckedChange={setResetRolls} />Renumber roll numbers alphabetically</label>
            <Button className="ml-auto" disabled={missingTarget} onClick={() => setConfirming(true)}><GraduationCap aria-hidden />Apply to {p.students.length} students</Button>
          </div>
        </div>
      )}
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} pending={run.isPending} title={`Apply changes to ${p?.section_label}?`}
        description="Students move to their new classes straight away. Attendance, marks and fees stay on their records." confirmLabel="Apply" onConfirm={() => run.mutate()} />
    </PermissionGate>
  );
}
