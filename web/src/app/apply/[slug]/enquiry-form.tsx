"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function EnquiryForm({ slug, classes }: { slug: string; classes: string[] }) {
  const [f, setF] = useState({ student_name: "", class_name: "", parent_name: "", phone: "", email: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch(`/api/proxy/public/schools/${encodeURIComponent(slug)}/enquiry`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        const details = (body?.error?.details ?? []) as { field: string; message: string }[];
        setErrors(Object.fromEntries(details.map((d) => [d.field, d.message.replace(/^Value error, /, "")])));
        setError(details.length ? "Please check the highlighted fields." : body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(body.data.message);
    } catch {
      setError("Couldn't reach the school. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm" role="status">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <h2 className="mt-4 text-xl font-bold">Enquiry sent</h2>
        <p className="mt-2 text-muted-foreground">{sent}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:grid-cols-2">
      <Field label="Child's full name" required error={errors.student_name} className="sm:col-span-2">
        {(a) => <Input {...a} value={f.student_name} onChange={set("student_name")} maxLength={200} autoComplete="off" />}
      </Field>
      <Field label="Class for admission" className="sm:col-span-2">
        {(a) => classes.length ? (
          <Select value={f.class_name || undefined} onValueChange={(v) => setF((x) => ({ ...x, class_name: String(v) }))}>
            <SelectTrigger id={a.id} className="w-full"><SelectValue placeholder="Choose a class">{f.class_name}</SelectValue></SelectTrigger>
            <SelectContent className="max-h-72">{classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        ) : <Input {...a} value={f.class_name} onChange={set("class_name")} maxLength={100} />}
      </Field>
      <Field label="Parent's name" required error={errors.parent_name}>{(a) => <Input {...a} value={f.parent_name} onChange={set("parent_name")} autoComplete="name" maxLength={200} />}</Field>
      <Field label="Phone" required error={errors.phone}>{(a) => <Input {...a} type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" maxLength={20} />}</Field>
      <Field label="Email" error={errors.email} className="sm:col-span-2">{(a) => <Input {...a} type="email" value={f.email} onChange={set("email")} autoComplete="email" />}</Field>
      <Field label="Anything you'd like to ask?" className="sm:col-span-2">{(a) => <Textarea {...a} rows={3} value={f.message} onChange={set("message")} maxLength={1000} />}</Field>
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{error}</p>}
      <Button type="submit" className="sm:col-span-2" loading={sending} loadingText="Sending…"
              disabled={!f.student_name.trim() || !f.parent_name.trim() || f.phone.trim().length < 6}><Send aria-hidden />Send enquiry</Button>
    </form>
  );
}
