"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export interface DashSection {
  id: string;
  label: string;
  node: React.ReactNode;
  /** Grid width on large screens, out of 6 columns. */
  span?: 2 | 3 | 4 | 6;
}

type Layout = { order: string[]; hidden: string[] };
type Prefs = { dashboards?: Record<string, Layout> };

const SPAN = { 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4", 6: "lg:col-span-6" } as const;

function usePrefs() {
  return useQuery({ queryKey: ["prefs"], queryFn: async () => (await api<Prefs>("/users/me/preferences")).data, staleTime: Infinity });
}

/** Puts saved order first, then any sections added since (in their default place), and drops ones that no longer exist. */
function arrange(ids: string[], saved?: Layout): Layout {
  const order = [...(saved?.order ?? []).filter((id) => ids.includes(id)), ...ids.filter((id) => !saved?.order.includes(id))];
  return { order, hidden: (saved?.hidden ?? []).filter((id) => ids.includes(id)) };
}

/**
 * Dashboard cards in the order the person chose, without the ones they hid. The layout is saved to their account, so it
 * follows them to every device; until it loads, the default layout shows.
 */
export function DashboardSections({ layoutKey, sections }: { layoutKey: string; sections: DashSection[] }) {
  const prefs = usePrefs();
  const layout = arrange(sections.map((s) => s.id), prefs.data?.dashboards?.[layoutKey]);
  const byId = new Map(sections.map((s) => [s.id, s]));
  return (
    <div className="grid grid-flow-row-dense gap-6 lg:grid-cols-6">
      {layout.order.filter((id) => !layout.hidden.includes(id)).map((id) => {
        const s = byId.get(id)!;
        return <div key={id} className={cn("min-w-0 [&>*]:h-full", SPAN[s.span ?? 6])}>{s.node}</div>;
      })}
    </div>
  );
}

/** "Customise" button for the dashboard header: show, hide and reorder cards. */
export function CustomiseDashboard({ layoutKey, sections, className }: { layoutKey: string; sections: Pick<DashSection, "id" | "label">[]; className?: string }) {
  const qc = useQueryClient();
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Layout | null>(null);
  const ids = sections.map((s) => s.id);
  const current = draft ?? arrange(ids, prefs.data?.dashboards?.[layoutKey]);
  const label = (id: string) => sections.find((s) => s.id === id)?.label ?? id;

  const save = useMutation({
    mutationFn: (l: Layout) => api<Prefs>("/users/me/preferences", { method: "PUT", body: { dashboards: { ...(prefs.data?.dashboards ?? {}), [layoutKey]: l } } }),
    // The dashboard changes as soon as you press Save; it goes back only if saving fails.
    onMutate: async (l) => {
      await qc.cancelQueries({ queryKey: ["prefs"] });
      const before = qc.getQueryData<Prefs>(["prefs"]);
      qc.setQueryData<Prefs>(["prefs"], { ...before, dashboards: { ...(before?.dashboards ?? {}), [layoutKey]: l } });
      setOpen(false);
      return before;
    },
    onSuccess: () => toast.success("Dashboard saved", { description: "Your layout follows you to every device." }),
    onError: (_e, _l, before) => { qc.setQueryData(["prefs"], before); toast.error("Could not save your layout"); },
  });

  const move = (i: number, by: number) => {
    const order = [...current.order];
    [order[i], order[i + by]] = [order[i + by], order[i]];
    setDraft({ ...current, order });
  };
  const toggle = (id: string) =>
    setDraft({ ...current, hidden: current.hidden.includes(id) ? current.hidden.filter((h) => h !== id) : [...current.hidden, id] });

  return (
    <>
      <button type="button" onClick={() => { setDraft(null); setOpen(true); }} className={className}>
        <SlidersHorizontal className="size-4" aria-hidden />Customise
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customise your dashboard</DialogTitle>
            <DialogDescription>Choose which cards to show and in what order. Saved to your account.</DialogDescription>
          </DialogHeader>
          <ol className="max-h-[60vh] space-y-1.5 overflow-y-auto" aria-label="Dashboard cards">
            {current.order.map((id, i) => {
              const hidden = current.hidden.includes(id);
              return (
                <li key={id} className={cn("flex items-center gap-2 rounded-xl border bg-card px-3 py-2 transition-opacity", hidden && "opacity-55")}>
                  <span className="flex-1 text-sm font-medium">{label(id)}{hidden && <span className="sr-only"> (hidden)</span>}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${label(id)} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move ${label(id)} down`} disabled={i === current.order.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden /></Button>
                  <Button variant="ghost" size="icon-sm" aria-pressed={!hidden} aria-label={hidden ? `Show ${label(id)}` : `Hide ${label(id)}`} onClick={() => toggle(id)}>
                    {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  </Button>
                </li>
              );
            })}
          </ol>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={() => setDraft({ order: ids, hidden: [] })}><RotateCcw aria-hidden />Reset</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate(current)}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
