"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "@/components/common/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/lib/use-hydrated";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(200),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(20),
  school_name: z.string().trim().max(200),
  students: z.string().trim().regex(/^\d*$/, "Numbers only"),
  message: z.string().trim().min(5, "Tell us a little about what you need").max(4000),
});
type Values = z.infer<typeof schema>;

export function ContactForm() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const modules = (params.get("modules") ?? "").split(",").filter(Boolean);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", email: "", phone: "", school_name: "", students: params.get("students") ?? "",
      message: modules.length ? `We'd like a quote for a custom plan with: ${modules.join(", ")}.` : "",
    },
  });

  const onSubmit = async (v: Values) => {
    setError(null);
    const res = await fetch("/api/proxy/public/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v, phone: v.phone || null, school_name: v.school_name || null,
        students: v.students ? Number(v.students) : null, modules: modules.length ? modules : null,
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setError(body?.error?.message ?? "Could not send your message. Please try again.");
    setSent(true);
  };

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-10 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <h2 className="mt-4 text-2xl font-bold">Thanks — we&apos;ve got your message</h2>
        <p className="mt-2 text-muted-foreground">Our team will reply within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate method="post" className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      {error && <Alert variant="destructive" className="mb-5"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message} required>{(a) => <Input {...a} {...register("name")} autoComplete="name" />}</Field>
        <Field label="Email" error={errors.email?.message} required>{(a) => <Input {...a} {...register("email")} type="email" autoComplete="email" />}</Field>
        <Field label="Phone" error={errors.phone?.message}>{(a) => <Input {...a} {...register("phone")} type="tel" autoComplete="tel" />}</Field>
        <Field label="School" error={errors.school_name?.message}>{(a) => <Input {...a} {...register("school_name")} autoComplete="organization" />}</Field>
        <Field label="Number of students" error={errors.students?.message} className="sm:col-span-2">{(a) => <Input {...a} {...register("students")} inputMode="numeric" />}</Field>
        <Field label="How can we help?" error={errors.message?.message} required className="sm:col-span-2">
          {(a) => <Textarea {...a} {...register("message")} rows={5} />}
        </Field>
      </div>
      <Button type="submit" size="lg" className="mt-6 h-11 w-full sm:w-auto sm:px-8" disabled={!hydrated} loading={isSubmitting} loadingText="Sending…">
        Send message
      </Button>
    </form>
  );
}
