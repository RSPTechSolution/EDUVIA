"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, History, Laptop, Package, Pencil, Plus, Save, Scale, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import type { Asset, StockItem } from "@/lib/api/types";
import { formatDate, formatDateTime, inr } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { useAssets, useStaffDirectory, useStockItems, useStockMoves } from "@/lib/queries";
import { cn } from "@/lib/utils";

const errText = (e: unknown, f: string) => (e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : f);
const qty = (n: number) => Number(n.toFixed(2)).toString();
const CONDITIONS = { good: "Good", needs_repair: "Needs repair", broken: "Broken", disposed: "Disposed" } as const;
const COND_TONE: Record<string, string> = { good: "bg-success/10 text-success", needs_repair: "bg-warning/10 text-warning", broken: "bg-destructive/10 text-destructive", disposed: "bg-muted text-muted-foreground" };
const MOVE_LABEL = { in: "Received", out: "Issued", adjust: "Stock count" } as const;

function ItemDialog({ item, open, onOpenChange }: { item: StockItem | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", category: "", unit: "pcs", reorder_level: "0", location: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setError(null); setF({ name: item?.name ?? "", category: item?.category ?? "", unit: item?.unit ?? "pcs", reorder_level: String(item?.reorder_level ?? 0), location: item?.location ?? "" }); }
  }, [open, item]);
  const save = useMutation({
    mutationFn: () => api(item ? `/inventory/items/${item.id}` : "/inventory/items", { method: item ? "PUT" : "POST", body: {
      name: f.name, category: f.category.trim() || null, unit: f.unit.trim() || "pcs", reorder_level: Number(f.reorder_level) || 0, location: f.location.trim() || null,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success(item ? "Item updated" : "Item added"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Edit item" : "Add a stock item"}</DialogTitle><DialogDescription>You&apos;ll be told when stock falls to the reorder level.</DialogDescription></DialogHeader>
        <form id="item-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required className="sm:col-span-2">{(a) => <Input {...a} value={f.name} onChange={set("name")} placeholder="e.g. A4 paper ream" />}</Field>
          <Field label="Category">{(a) => <Input {...a} value={f.category} onChange={set("category")} placeholder="Stationery" />}</Field>
          <Field label="Unit">{(a) => <Input {...a} value={f.unit} onChange={set("unit")} placeholder="pcs, box, ream" />}</Field>
          <Field label="Reorder level">{(a) => <Input {...a} type="number" min={0} value={f.reorder_level} onChange={set("reorder_level")} />}</Field>
          <Field label="Kept in">{(a) => <Input {...a} value={f.location} onChange={set("location")} placeholder="Store room" />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="item-form" disabled={f.name.trim().length < 2} loading={save.isPending}><Save aria-hidden />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ item, kind, onClose }: { item: StockItem | null; kind: "in" | "out" | "adjust"; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ quantity: "", unit_cost: "", party: "", note: "" });
  useEffect(() => { if (item) setF({ quantity: kind === "adjust" ? qty(item.quantity) : "", unit_cost: "", party: "", note: "" }); }, [item, kind]);
  const save = useMutation({
    mutationFn: () => api<StockItem>(`/inventory/items/${item!.id}/moves`, { method: "POST", body: {
      kind, quantity: Number(f.quantity), unit_cost: f.unit_cost ? Number(f.unit_cost) : null, party: f.party.trim() || null, note: f.note.trim() || null,
    } }),
    onSuccess: ({ data }) => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success(`${data.name}: ${qty(data.quantity)} ${data.unit} in stock`); onClose(); },
    onError: (e) => toast.error(errText(e, "Could not save")),
  });
  const title = { in: "Receive stock", out: "Issue stock", adjust: "Stock count" }[kind];
  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}: {item?.name}</DialogTitle><DialogDescription>{item ? `${qty(item.quantity)} ${item.unit} in stock now.` : ""}{kind === "adjust" ? " Enter what you counted." : ""}</DialogDescription></DialogHeader>
        <form id="move-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label={kind === "adjust" ? "Counted quantity" : "Quantity"} required>{(a) => <Input {...a} type="number" min={0} step="any" value={f.quantity} onChange={(e) => setF((x) => ({ ...x, quantity: e.target.value }))} />}</Field>
          {kind === "in" && <Field label="Unit cost (₹)">{(a) => <Input {...a} type="number" min={0} step="any" value={f.unit_cost} onChange={(e) => setF((x) => ({ ...x, unit_cost: e.target.value }))} />}</Field>}
          {kind !== "adjust" && <Field label={kind === "in" ? "Supplier" : "Issued to"} className="sm:col-span-2">{(a) => <Input {...a} value={f.party} onChange={(e) => setF((x) => ({ ...x, party: e.target.value }))} />}</Field>}
          <Field label="Note" className="sm:col-span-2">{(a) => <Input {...a} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />}</Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="move-form" disabled={!(Number(f.quantity) > 0)} loading={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovesSheet({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const q = useStockMoves(item?.id ?? null);
  return (
    <Sheet open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{item?.name}</SheetTitle><SheetDescription>Stock register</SheetDescription></SheetHeader>
        {!q.data ? <Skeleton className="m-4 h-40" /> : !q.data.length ? <p className="px-4 text-sm text-muted-foreground">No movements yet.</p> : (
          <ul className="divide-y px-4 pb-4 text-sm">
            {q.data.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{MOVE_LABEL[m.kind]}</span>{m.party && <span className="text-muted-foreground"> · {m.party}</span>}
                  <span className="block text-xs text-muted-foreground">{formatDateTime(m.at)}{m.by ? ` · ${m.by}` : ""}{m.note ? ` · ${m.note}` : ""}{m.unit_cost != null ? ` · ${inr(m.unit_cost)} each` : ""}</span>
                </span>
                <span className={cn("tabular font-semibold", m.quantity >= 0 ? "text-success" : "text-destructive")}>{m.quantity >= 0 ? "+" : ""}{qty(m.quantity)}</span>
                <span className="w-16 text-right tabular text-muted-foreground">{qty(m.balance_after)}</span>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StockTab() {
  const can = useCan();
  const manage = can("inventory.manage");
  const [low, setLow] = useState(false);
  const q = useStockItems(low);
  const [editing, setEditing] = useState<StockItem | null | undefined>(undefined);
  const [moving, setMoving] = useState<{ item: StockItem; kind: "in" | "out" | "adjust" } | null>(null);
  const [history, setHistory] = useState<StockItem | null>(null);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={low} onCheckedChange={setLow} />Only low stock</label>
        {manage && <Button className="ml-auto" onClick={() => setEditing(null)}><Plus aria-hidden />Add item</Button>}
      </div>
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Package className="size-12 text-muted-foreground/60" aria-hidden />} title={low ? "Nothing is running low" : "No stock items yet"} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Stock</caption>
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="px-4 py-2">Item</th><th scope="col" className="px-2 py-2">Category</th><th scope="col" className="px-2 py-2 text-right">In stock</th><th scope="col" className="px-2 py-2 text-right">Reorder at</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {q.data.map((i) => (
                <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2"><span className="font-medium">{i.name}</span><span className="block text-xs text-muted-foreground">{i.location ?? "—"}</span></td>
                  <td className="px-2 py-2">{i.category ?? "—"}</td>
                  <td className={cn("px-2 py-2 text-right tabular font-semibold", i.low && "text-destructive")}>{i.low && <AlertTriangle className="mr-1 inline size-3.5" aria-label="Low stock" />}{qty(i.quantity)} {i.unit}</td>
                  <td className="px-2 py-2 text-right tabular text-muted-foreground">{qty(i.reorder_level)}</td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end gap-1">
                      {manage && <Button size="sm" variant="outline" onClick={() => setMoving({ item: i, kind: "in" })}><ArrowDownToLine aria-hidden />In</Button>}
                      {manage && <Button size="sm" variant="outline" onClick={() => setMoving({ item: i, kind: "out" })}><ArrowUpFromLine aria-hidden />Out</Button>}
                      {manage && <Button size="icon" variant="ghost" aria-label={`Count ${i.name}`} onClick={() => setMoving({ item: i, kind: "adjust" })}><Scale aria-hidden /></Button>}
                      <Button size="icon" variant="ghost" aria-label={`History of ${i.name}`} onClick={() => setHistory(i)}><History aria-hidden /></Button>
                      {manage && <Button size="icon" variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)}><Pencil aria-hidden /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ItemDialog item={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />
      <MoveDialog item={moving?.item ?? null} kind={moving?.kind ?? "in"} onClose={() => setMoving(null)} />
      <MovesSheet item={history} onClose={() => setHistory(null)} />
    </>
  );
}

function AssetDialog({ asset, open, onOpenChange }: { asset: Asset | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const staff = useStaffDirectory();
  const empty = { tag: "", name: "", category: "", location: "", purchased_on: "", cost: "", vendor: "", warranty_until: "", condition: "good", assigned_to: "none", notes: "" };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setF(asset ? Object.fromEntries(Object.entries(empty).map(([k, d]) => { const v = asset[k as keyof Asset]; return [k, v == null ? d : String(v)]; })) as typeof empty : empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asset]);
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
      body.cost = f.cost ? Number(f.cost) : null;
      body.assigned_to = f.assigned_to === "none" ? null : f.assigned_to;
      return api(asset ? `/inventory/assets/${asset.id}` : "/inventory/assets", { method: asset ? "PUT" : "POST", body });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success(asset ? "Asset updated" : "Asset added"); onOpenChange(false); },
    onError: (e) => setError(errText(e, "Could not save")),
  });
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const people = staff.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{asset ? `Asset ${asset.tag}` : "Add an asset"}</DialogTitle><DialogDescription>Leave the tag empty to number it automatically.</DialogDescription></DialogHeader>
        <form id="asset-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name" required>{(a) => <Input {...a} value={f.name} onChange={set("name")} placeholder="e.g. Epson projector" />}</Field>
          <Field label="Tag">{(a) => <Input {...a} value={f.tag} onChange={set("tag")} placeholder="AST-00012" />}</Field>
          <Field label="Category">{(a) => <Input {...a} value={f.category} onChange={set("category")} placeholder="IT, Furniture, Lab" />}</Field>
          <Field label="Location">{(a) => <Input {...a} value={f.location} onChange={set("location")} placeholder="Room 12" />}</Field>
          <Field label="Bought on">{(a) => <Input {...a} type="date" value={f.purchased_on} onChange={set("purchased_on")} />}</Field>
          <Field label="Cost (₹)">{(a) => <Input {...a} type="number" min={0} value={f.cost} onChange={set("cost")} />}</Field>
          <Field label="Vendor">{(a) => <Input {...a} value={f.vendor} onChange={set("vendor")} />}</Field>
          <Field label="Warranty until">{(a) => <Input {...a} type="date" value={f.warranty_until} onChange={set("warranty_until")} />}</Field>
          <Field label="Condition">
            {(a) => (
              <Select value={f.condition} onValueChange={(v) => setF((x) => ({ ...x, condition: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{CONDITIONS[f.condition as keyof typeof CONDITIONS]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(CONDITIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="In the care of">
            {(a) => (
              <Select value={f.assigned_to} onValueChange={(v) => setF((x) => ({ ...x, assigned_to: String(v) }))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{f.assigned_to === "none" ? "Nobody" : people.find((p) => p.user_id === f.assigned_to)?.full_name ?? asset?.assigned_name}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="none">Nobody</SelectItem>{people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Notes" className="sm:col-span-2">{(a) => <Textarea {...a} rows={2} value={f.notes} onChange={set("notes")} />}</Field>
        </form>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="asset-form" disabled={f.name.trim().length < 2} loading={save.isPending}><Save aria-hidden />Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetsTab() {
  const can = useCan();
  const manage = can("inventory.manage");
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("all");
  const q = useAssets(useDebounced(search.trim()), condition === "all" ? undefined : condition);
  const [editing, setEditing] = useState<Asset | null | undefined>(undefined);
  const total = (q.data ?? []).reduce((s, a) => s + (a.condition !== "disposed" ? a.cost ?? 0 : 0), 0);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, tag or room" className="h-9 pl-9" aria-label="Search assets" />
        </div>
        <Select value={condition} onValueChange={(v) => setCondition(String(v))}>
          <SelectTrigger aria-label="Condition" className="w-44"><SelectValue>{condition === "all" ? "Any condition" : CONDITIONS[condition as keyof typeof CONDITIONS]}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">Any condition</SelectItem>{Object.entries(CONDITIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{q.data?.length ?? 0} assets · {inr(total)}</span>
        {manage && <Button className="ml-auto" onClick={() => setEditing(null)}><Plus aria-hidden />Add asset</Button>}
      </div>
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<Laptop className="size-12 text-muted-foreground/60" aria-hidden />} title="No assets match" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Assets</caption>
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="px-4 py-2">Asset</th><th scope="col" className="px-2 py-2">Location</th><th scope="col" className="px-2 py-2">Condition</th><th scope="col" className="px-2 py-2">Warranty</th><th scope="col" className="px-2 py-2 text-right">Cost</th><th scope="col"><span className="sr-only">Edit</span></th></tr></thead>
            <tbody>
              {q.data.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2"><span className="font-medium">{a.name}</span><span className="block text-xs text-muted-foreground"><span className="font-mono">{a.tag}</span>{a.category ? ` · ${a.category}` : ""}{a.assigned_name ? ` · ${a.assigned_name}` : ""}</span></td>
                  <td className="px-2 py-2">{a.location ?? "—"}</td>
                  <td className="px-2 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", COND_TONE[a.condition])}>{CONDITIONS[a.condition]}</span></td>
                  <td className={cn("px-2 py-2 whitespace-nowrap", a.warranty_ok === false && "text-muted-foreground line-through")}>{a.warranty_until ? formatDate(a.warranty_until) : "—"}</td>
                  <td className="px-2 py-2 text-right tabular">{a.cost != null ? inr(a.cost) : "—"}</td>
                  <td className="px-2 py-1 text-right">{manage && <Button size="icon" variant="ghost" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}><Pencil aria-hidden /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {manage && <AssetDialog asset={editing ?? null} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} />}
    </>
  );
}

function InventoryPage() {
  const [tab, setTab] = useState(useSearchParams().get("tab") ?? "stock");
  return (
    <>
      <PageHeader title="Inventory and assets" description="Store stock with low-stock alerts, and the register of the school's equipment." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mb-5">
        <TabsList><TabsTrigger value="stock">Stock</TabsTrigger><TabsTrigger value="assets">Assets</TabsTrigger></TabsList>
      </Tabs>
      {tab === "stock" ? <StockTab /> : <AssetsTab />}
    </>
  );
}

export default function Page() {
  return <PermissionGate permission="inventory.view"><Suspense><InventoryPage /></Suspense></PermissionGate>;
}
