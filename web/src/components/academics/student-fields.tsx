"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import { z } from "zod";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ClassItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

/** Mirrors the API's StudentBase rules. */
export const studentSchema = z
  .object({
    first_name: z.string().trim().min(1, "Enter the first name").max(100),
    last_name: z.string().trim().min(1, "Enter the last name").max(100),
    gender: z.enum(["male", "female", "other"], { message: "Choose a gender" }),
    date_of_birth: z.string().min(1, "Enter the date of birth"),
    admission_no: z.string().trim().min(1, "Enter the admission number").max(50),
    admission_date: z.string().min(1, "Enter the admission date"),
    class_id: z.string().min(1, "Choose a class"),
    section_id: z.string().min(1, "Choose a section"),
    roll_no: z.string().regex(/^\d*$/, "Numbers only"),
    blood_group: z.string(),
    address: z.string().max(1000),
  })
  .refine((v) => !v.date_of_birth || v.date_of_birth < today(), { path: ["date_of_birth"], message: "Date of birth must be in the past" })
  .refine((v) => !v.date_of_birth || !v.admission_date || v.admission_date >= v.date_of_birth, {
    path: ["admission_date"], message: "Can't be before the date of birth",
  });

export type StudentValues = z.infer<typeof studentSchema>;

export const emptyStudent = (): StudentValues => ({
  first_name: "", last_name: "", gender: "" as StudentValues["gender"], date_of_birth: "", admission_no: "",
  admission_date: today(), class_id: "", section_id: "", roll_no: "", blood_group: "", address: "",
});

export function toApi(v: StudentValues) {
  return {
    ...v,
    first_name: v.first_name.trim(),
    last_name: v.last_name.trim(),
    roll_no: v.roll_no ? Number(v.roll_no) : null,
    blood_group: v.blood_group || null,
    address: v.address.trim() || null,
  };
}

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function SectionTitle({ step, title, hint }: { step?: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {step && <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{step}</span>}
      <div>
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** Personal + placement fields. Used by "Add student" and the profile's edit panel. */
export function StudentFields({
  control, register, errors, watch, classes, onClassChange, compact,
}: {
  control: Control<StudentValues>;
  register: UseFormRegister<StudentValues>;
  errors: FieldErrors<StudentValues>;
  watch: UseFormWatch<StudentValues>;
  classes: ClassItem[];
  onClassChange: () => void;
  compact?: boolean;
}) {
  const cls = classes.find((c) => c.id === watch("class_id"));
  const grid = cn("grid gap-4", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3");
  return (
    <>
      <div className={grid}>
        <Field label="First name" error={errors.first_name?.message} required>{(a) => <Input {...a} {...register("first_name")} autoComplete="off" />}</Field>
        <Field label="Last name" error={errors.last_name?.message} required>{(a) => <Input {...a} {...register("last_name")} autoComplete="off" />}</Field>
        <Field label="Gender" error={errors.gender?.message} required>
          {(a) => (
            <Controller control={control} name="gender" render={({ field }) => (
              <div role="radiogroup" aria-label="Gender" aria-invalid={a["aria-invalid"]} aria-describedby={a["aria-describedby"]} className="grid grid-cols-3 gap-1.5" id={a.id}>
                {(["female", "male", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={field.value === g}
                    onClick={() => field.onChange(g)}
                    className={cn(
                      "h-9 rounded-lg border text-sm capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      field.value === g ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )} />
          )}
        </Field>
        <Field label="Date of birth" error={errors.date_of_birth?.message} required>{(a) => <Input {...a} {...register("date_of_birth")} type="date" max={today()} />}</Field>
        <Field label="Blood group" error={errors.blood_group?.message}>
          {(a) => (
            <Controller control={control} name="blood_group" render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : String(v))}>
                <SelectTrigger id={a.id} className="w-full"><SelectValue>{field.value || "Not recorded"}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not recorded</SelectItem>
                  {BLOOD.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          )}
        </Field>
      </div>

      <div className={cn(grid, "mt-4")}>
        <Field label="Admission number" error={errors.admission_no?.message} required>{(a) => <Input {...a} {...register("admission_no")} className="font-mono" autoComplete="off" />}</Field>
        <Field label="Admission date" error={errors.admission_date?.message} required>{(a) => <Input {...a} {...register("admission_date")} type="date" />}</Field>
        <Field label="Class" error={errors.class_id?.message} required>
          {(a) => (
            <Controller control={control} name="class_id" render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={(v) => { field.onChange(String(v)); onClassChange(); }}>
                <SelectTrigger id={a.id} aria-invalid={a["aria-invalid"]} className="w-full"><SelectValue placeholder="Choose a class">{cls?.name}</SelectValue></SelectTrigger>
                <SelectContent className="max-h-72">{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          )}
        </Field>
        <Field label="Section" error={errors.section_id?.message} required hint={!cls ? "Choose a class first" : undefined}>
          {(a) => (
            <Controller control={control} name="section_id" render={({ field }) => {
              const sec = cls?.sections.find((s) => s.id === field.value);
              return (
                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(String(v))} disabled={!cls}>
                  <SelectTrigger id={a.id} aria-invalid={a["aria-invalid"]} className="w-full"><SelectValue placeholder="Choose a section">{sec ? `Section ${sec.name}` : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {cls?.sections.map((s) => {
                      const full = s.capacity !== null && s.student_count >= s.capacity;
                      return (
                        <SelectItem key={s.id} value={s.id} disabled={full}>
                          Section {s.name} <span className="ml-auto text-xs text-muted-foreground">{s.student_count}{s.capacity ? `/${s.capacity}` : ""}{full ? " · full" : ""}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              );
            }} />
          )}
        </Field>
        <Field label="Roll number" error={errors.roll_no?.message}>{(a) => <Input {...a} {...register("roll_no")} inputMode="numeric" />}</Field>
      </div>

      <Field label="Address" error={errors.address?.message} className="mt-4">{(a) => <Textarea {...a} {...register("address")} rows={2} autoComplete="street-address" />}</Field>
    </>
  );
}
