"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, MoreHorizontal, Plus, Power, PowerOff, Search, ToggleRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type Col } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import type { ModuleState, School } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { generatePassword, useDebounced } from "@/lib/hooks";
import { qk, useSchools } from "@/lib/queries";
import { newPassword } from "@/lib/validation";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

const schema = z.object({
  name: z.string().trim().min(2, "Enter the school name").max(200),
  slug: z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/, "3–50 characters: lowercase letters, numbers and hyphens"),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  admin_full_name: z.string().trim().min(2, "Enter the admin's name"),
  admin_email: z.string().trim().email("Enter a valid email"),
  admin_password: newPassword,
});
type Values = z.infer<typeof schema>;

function NewSchoolDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const { register, handleSubmit, control, reset, setValue, watch, setError, formState: { errors, dirtyFields } } = useForm<Values>({
    resolver: zodResolver(schema),
  });
  useEffect(() => {
    if (open) reset({ name: "", slug: "", timezone: "Asia/Kolkata", currency: "INR", admin_full_name: "", admin_email: "", admin_password: generatePassword() });
  }, [open, reset]);

  const name = watch("name");
  useEffect(() => {
    if (!dirtyFields.slug && name !== undefined) setValue("slug", slugify(name));
  }, [name, dirtyFields.slug, setValue]);

  const create = useMutation({
    mutationFn: (v: Values) => api<School>("/schools", { method: "POST", body: v }),
    onSuccess: ({ data }, v) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "schools"] });
      onOpenChange(false);
      toast.success(`${data.name} is ready`, {
        description: `Admin signs in with school ID “${data.slug}”, ${v.admin_email} and temporary password ${v.admin_password}.`,
        duration: 20000,
      });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "SLUG_TAKEN") setError("slug", { message: e.message });
      else if (e instanceof ApiError && e.status === 422) Object.entries(e.fieldErrors).forEach(([f, m]) => setError(f as keyof Values, { message: m }));
      else toast.error(e instanceof ApiError ? e.message : "Could not create the school");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New school</DialogTitle>
          <DialogDescription>Creates the school, its first admin account and the default modules.</DialogDescription>
        </DialogHeader>
        <form id="school-form" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 sm:grid-cols-2">
          <Field label="School name" error={errors.name?.message} required className="sm:col-span-2">
            {(a) => <Input {...a} {...register("name")} />}
          </Field>
          <Field label="School ID" error={errors.slug?.message} required hint="Staff type this to sign in.">
            {(a) => <Input {...a} {...register("slug")} className="font-mono" autoCapitalize="none" spellCheck={false} />}
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            {(a) => <Input {...a} {...register("currency", { setValueAs: (v: string) => v.toUpperCase() })} maxLength={3} className="uppercase" />}
          </Field>
          <Field label="Time zone" className="sm:col-span-2">
            {(a) => (
              <Controller control={control} name="timezone" render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                  <SelectTrigger id={a.id} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">{timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            )}
          </Field>
          <p className="pt-2 text-sm font-semibold sm:col-span-2">First admin</p>
          <Field label="Full name" error={errors.admin_full_name?.message} required>
            {(a) => <Input {...a} {...register("admin_full_name")} autoComplete="off" />}
          </Field>
          <Field label="Email" error={errors.admin_email?.message} required>
            {(a) => <Input {...a} {...register("admin_email")} type="email" autoComplete="off" />}
          </Field>
          <Field label="Temporary password" error={errors.admin_password?.message} required className="sm:col-span-2" hint="They'll be asked to change it at first sign-in.">
            {(a) => <Input {...a} {...register("admin_password")} className="font-mono" autoComplete="off" />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
          <Button type="submit" form="school-form" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}Create school
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchoolModulesSheet({ school, onClose }: { school: School | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const modules = useQuery({
    queryKey: qk.schoolModules(school?.id ?? ""),
    enabled: Boolean(school),
    queryFn: async () => (await api<ModuleState[]>(`/schools/${school!.id}/modules`)).data,
  });
  const toggle = useMutation({
    mutationFn: ({ module, is_enabled }: { module: string; is_enabled: boolean }) =>
      api(`/schools/${school!.id}/modules/${module}`, { method: "PUT", body: { is_enabled } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.schoolModules(school!.id) }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not update"),
  });
  return (
    <Sheet open={Boolean(school)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Modules · {school?.name}</SheetTitle>
          <SheetDescription>Turn features on or off for this school.</SheetDescription>
        </SheetHeader>
        <ul className="flex-1 divide-y overflow-y-auto px-4">
          {modules.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <li key={i} className="py-3"><Skeleton className="h-6" /></li>)
            : modules.data?.map((m) => (
                <li key={m.module} className="flex items-center justify-between py-3">
                  <label htmlFor={`sm-${m.module}`} className="text-sm font-medium">{m.label}</label>
                  <Switch id={`sm-${m.module}`} checked={m.is_enabled} disabled={toggle.isPending}
                    onCheckedChange={(c) => toggle.mutate({ module: m.module, is_enabled: c })} />
                </li>
              ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function SchoolsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const schools = useSchools({ page, search: q || undefined });
  const [creating, setCreating] = useState(false);
  const [modulesFor, setModulesFor] = useState<School | null>(null);
  const [suspend, setSuspend] = useState<School | null>(null);

  const setActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api<School>(`/schools/${id}`, { method: "PATCH", body: { is_active } }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "schools"] });
      setSuspend(null);
      toast.success(`${data.name} ${data.is_active ? "reactivated" : "suspended"}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not update"),
  });

  const columns = useMemo<Col<School>[]>(() => [
    {
      id: "school",
      header: "School",
      cell: ({ row: { original: s } }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{s.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{s.slug}</p>
        </div>
      ),
    },
    { id: "location", header: "Location", cell: ({ row: { original: s } }) => <span className="text-muted-foreground">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</span> },
    { id: "plan", header: "Plan", cell: ({ row }) => <span className="capitalize">{row.original.plan}</span> },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.is_active ? "active" : "suspended"} /> },
    { id: "created", header: "Created", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.created_at)}</span> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row: { original: s } }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${s.name}`} />}><MoreHorizontal aria-hidden /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setModulesFor(s)}><ToggleRight aria-hidden />Modules</DropdownMenuItem>
              {s.is_active ? (
                <DropdownMenuItem variant="destructive" onClick={() => setSuspend(s)}><PowerOff aria-hidden />Suspend</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setActive.mutate({ id: s.id, is_active: true })}><Power aria-hidden />Reactivate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [setActive]);

  return (
    <>
      <PageHeader title="Schools" description="Every school on the platform." actions={<Button onClick={() => setCreating(true)}><Plus aria-hidden />New school</Button>} />
      <div className="relative mb-4 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or ID" className="h-9 pl-9" aria-label="Search schools" />
      </div>
      <DataTable
        caption="Schools"
        columns={columns}
        data={schools.data?.data ?? []}
        meta={schools.data?.meta}
        loading={schools.isLoading}
        onPageChange={setPage}
        getRowId={(s) => s.id}
        empty={<EmptyState icon={Building2} title={q ? "No schools match" : "No schools yet"} description={q ? undefined : "Create the first school to get started."} />}
      />
      <NewSchoolDialog open={creating} onOpenChange={setCreating} />
      <SchoolModulesSheet school={modulesFor} onClose={() => setModulesFor(null)} />
      <ConfirmDialog
        open={Boolean(suspend)}
        onOpenChange={(o) => !o && setSuspend(null)}
        destructive
        pending={setActive.isPending}
        title={`Suspend ${suspend?.name}?`}
        description="Everyone at this school is signed out immediately and can't sign in until you reactivate it. No data is deleted."
        confirmLabel="Suspend school"
        onConfirm={() => suspend && setActive.mutate({ id: suspend.id, is_active: false })}
      />
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate superAdmin>
      <SchoolsPage />
    </PermissionGate>
  );
}
