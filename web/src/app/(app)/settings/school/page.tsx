"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { useCan } from "@/components/session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import type { School } from "@/lib/api/types";
import { qk, useCurrentSchool } from "@/lib/queries";
import { timeZoneOptions, tzLabel } from "@/lib/timezones";

const optional = (max: number) => z.string().trim().max(max);
const schema = z.object({
  name: z.string().trim().min(2, "Enter the school name").max(200),
  phone: optional(20),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  address: optional(500),
  city: optional(100),
  state: optional(100),
  timezone: z.string().min(1),
  currency: z.string().length(3, "Use a 3-letter code such as INR"),
});
type Values = z.infer<typeof schema>;

const CURRENCIES = ["INR", "USD", "AED", "GBP", "EUR", "SGD", "NPR", "BDT", "LKR", "KES", "NGN"];

function toValues(s: School): Values {
  return {
    name: s.name, phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "",
    city: s.city ?? "", state: s.state ?? "", timezone: s.timezone, currency: s.currency,
  };
}

function SchoolProfilePage() {
  const can = useCan();
  const editable = can("school.manage");
  const school = useCurrentSchool();
  const queryClient = useQueryClient();
  const router = useRouter();
  const savedTz = school.data?.timezone;
  const timezones = useMemo(() => timeZoneOptions(savedTz), [savedTz]);

  // Every field starts defined so inputs stay controlled while the school loads.
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", address: "", city: "", state: "", timezone: "Asia/Kolkata", currency: "INR" },
  });
  const { register, handleSubmit, reset, control, setError, formState: { errors, isDirty, dirtyFields } } = form;
  useEffect(() => {
    if (school.data) reset(toValues(school.data));
  }, [school.data, reset]);

  const save = useMutation({
    // Only send what the user changed, so a field can never be overwritten by accident.
    mutationFn: (v: Values) => {
      const changed = Object.fromEntries(
        (Object.keys(dirtyFields) as (keyof Values)[]).map((k) => [k, typeof v[k] === "string" && v[k] === "" && k !== "name" ? null : v[k]]),
      );
      return api<School>("/schools/current", { method: "PATCH", body: changed });
    },
    onSuccess: ({ data }) => {
      queryClient.setQueryData(qk.school, data);
      reset(toValues(data));
      router.refresh(); // school name in the sidebar comes from the server session
      toast.success("School profile saved");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        for (const [field, message] of Object.entries(e.fieldErrors)) setError(field as keyof Values, { message });
      } else toast.error(e instanceof ApiError ? e.message : "Could not save");
    },
  });

  return (
    <>
      <PageHeader title="School profile" description="Shown on receipts, certificates, report cards and messages to parents." />
      {!editable && (
        <Alert className="mb-6"><AlertDescription>Only school admins can change these details.</AlertDescription></Alert>
      )}
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>School ID: <code className="font-mono text-foreground">{school.data?.slug ?? "…"}</code> — staff use this to sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            {school.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (
              <fieldset disabled={!editable || save.isPending} className="grid gap-5 sm:grid-cols-2">
                <Field label="School name" error={errors.name?.message} required className="sm:col-span-2">
                  {(a) => <Input {...a} {...register("name")} />}
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
                  {(a) => <Input {...a} {...register("phone")} type="tel" autoComplete="tel" />}
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  {(a) => <Input {...a} {...register("email")} type="email" />}
                </Field>
                <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
                  {(a) => <Input {...a} {...register("address")} autoComplete="street-address" />}
                </Field>
                <Field label="City" error={errors.city?.message}>
                  {(a) => <Input {...a} {...register("city")} />}
                </Field>
                <Field label="State" error={errors.state?.message}>
                  {(a) => <Input {...a} {...register("state")} />}
                </Field>
                <Field label="Time zone" hint="Used for attendance dates, reminders and reports." error={errors.timezone?.message}>
                  {(a) => (
                    <Controller control={control} name="timezone" render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)} disabled={!editable}>
                        <SelectTrigger id={a.id} className="w-full"><SelectValue>{tzLabel(field.value)}</SelectValue></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {timezones.map((tz) => <SelectItem key={tz} value={tz}>{tzLabel(tz)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  )}
                </Field>
                <Field label="Currency" error={errors.currency?.message}>
                  {(a) => (
                    <Controller control={control} name="currency" render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => field.onChange(v)} disabled={!editable}>
                        <SelectTrigger id={a.id} className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    )} />
                  )}
                </Field>
              </fieldset>
            )}
          </CardContent>
          {editable && (
            <CardFooter className="justify-end gap-2 border-t">
              <Button type="button" variant="outline" disabled={!isDirty || save.isPending} onClick={() => school.data && reset(toValues(school.data))}>
                Discard
              </Button>
              <Button type="submit" disabled={!isDirty} loading={save.isPending} loadingText="Saving…">
                Save changes
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>
    </>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="school.view">
      <SchoolProfilePage />
    </PermissionGate>
  );
}
