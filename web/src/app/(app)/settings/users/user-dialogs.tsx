"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { SCHOOL_ROLES, roleLabel } from "@/lib/format";
import { generatePassword } from "@/lib/hooks";
import { newPassword } from "@/lib/validation";

const base = {
  full_name: z.string().trim().min(2, "Enter the full name").max(200),
  phone: z.string().trim().max(20),
  role: z.string().min(1, "Choose a role"),
};
const createSchema = z.object({ ...base, email: z.string().trim().email("Enter a valid email"), password: newPassword });
const editSchema = z.object(base);
type CreateValues = z.infer<typeof createSchema>;

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success("Copied to clipboard"), () => undefined);
}

function PasswordInput({ a, value, onChange }: { a: object; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input {...a} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" autoComplete="off" />
      <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => onChange(generatePassword())} aria-label="Generate password">
        <RefreshCw aria-hidden />
      </Button>
      <Button type="button" variant="outline" size="icon" className="size-9" onClick={() => copy(value)} disabled={!value} aria-label="Copy password">
        <Copy aria-hidden />
      </Button>
    </div>
  );
}

function RoleSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose a role">{roleLabel(value)}</SelectValue></SelectTrigger>
      <SelectContent>
        {SCHOOL_ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function applyServerErrors(e: unknown, setError: (f: never, v: { message: string }) => void) {
  if (e instanceof ApiError && e.status === 422) {
    for (const [field, message] of Object.entries(e.fieldErrors)) setError(field as never, { message });
    return true;
  }
  if (e instanceof ApiError && e.code === "EMAIL_TAKEN") {
    setError("email" as never, { message: e.message });
    return true;
  }
  return false;
}

export function UserFormDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user?: User | null }) {
  const editing = Boolean(user);
  const queryClient = useQueryClient();
  const form = useForm<CreateValues>({
    resolver: zodResolver(editing ? (editSchema as unknown as typeof createSchema) : createSchema),
    defaultValues: { full_name: "", phone: "", role: "teacher", email: "", password: "" },
  });
  const { register, handleSubmit, control, reset, setError, formState: { errors } } = form;

  useEffect(() => {
    if (!open) return;
    reset(user
      ? { full_name: user.full_name, phone: user.phone ?? "", role: user.role, email: user.email, password: "" }
      : { full_name: "", phone: "", role: "teacher", email: "", password: generatePassword() });
  }, [open, user, reset]);

  const save = useMutation({
    mutationFn: (v: CreateValues) =>
      editing
        ? api<User>(`/users/${user!.id}`, { method: "PATCH", body: { full_name: v.full_name, phone: v.phone || null, role: v.role } })
        : api<User>("/users", { method: "POST", body: { ...v, phone: v.phone || null } }),
    onSuccess: ({ data }, v) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
      toast.success(editing ? "User updated" : `Account created for ${data.full_name}`, {
        description: editing ? undefined : `Share the temporary password ${v.password} — they'll be asked to change it.`,
        duration: editing ? 4000 : 15000,
      });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PLAN_LIMIT_REACHED") {
        toast.error(e.message, { action: { label: "View plans", onClick: () => window.location.assign("/settings/billing") } });
        return;
      }
      if (!applyServerErrors(e, setError as never)) toast.error(e instanceof ApiError ? e.message : "Could not save");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing ? "Role changes take effect the next time they sign in." : "They'll sign in with your school ID, this email and the temporary password."}
          </DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.full_name?.message} required className="sm:col-span-2">
            {(a) => <Input {...a} {...register("full_name")} autoComplete="off" />}
          </Field>
          <Field label="Email" error={errors.email?.message} required={!editing} hint={editing ? "Email can't be changed." : undefined}>
            {(a) => <Input {...a} {...register("email")} type="email" disabled={editing} autoComplete="off" />}
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            {(a) => <Input {...a} {...register("phone")} type="tel" autoComplete="off" />}
          </Field>
          <Field label="Role" error={errors.role?.message} required className="sm:col-span-2">
            {(a) => <Controller control={control} name="role" render={({ field }) => <RoleSelect id={a.id} value={field.value} onChange={field.onChange} />} />}
          </Field>
          {!editing && (
            <Field label="Temporary password" error={errors.password?.message} required className="sm:col-span-2" hint="They must change it after signing in.">
              {(a) => <Controller control={control} name="password" render={({ field }) => <PasswordInput a={a} value={field.value ?? ""} onChange={field.onChange} />} />}
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="user-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {editing ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SetPasswordDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: User | null }) {
  const schema = z.object({ password: newPassword });
  const { handleSubmit, control, reset, formState: { errors } } = useForm<{ password: string }>({ resolver: zodResolver(schema), defaultValues: { password: "" } });
  useEffect(() => {
    if (open) reset({ password: generatePassword() });
  }, [open, reset]);

  const save = useMutation({
    mutationFn: (v: { password: string }) => api(`/users/${user!.id}/set-password`, { method: "POST", body: v }),
    onSuccess: (_d, v) => {
      onOpenChange(false);
      toast.success(`New password set for ${user?.full_name}`, {
        description: `Temporary password: ${v.password}. They've been signed out and must change it at next sign-in.`,
        duration: 15000,
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not set the password"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a temporary password for {user?.full_name}. They&apos;ll be signed out of all devices.</DialogDescription>
        </DialogHeader>
        <form id="pw-form" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          <Field label="Temporary password" error={errors.password?.message} required>
            {(a) => <Controller control={control} name="password" render={({ field }) => <PasswordInput a={a} value={field.value ?? ""} onChange={field.onChange} />} />}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="pw-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}Set password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
