"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInYears, parseISO } from "date-fns";
import { ArrowLeft, Cake, ChevronRight, Droplet, Hash, KeyRound, MapPin, Pencil, Phone, Plus, Star, Unlink, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ParentPicker } from "@/components/academics/pickers";
import { StudentRecords } from "@/components/academics/student-records";
import { StudentOverviewSection } from "@/components/profile/sections";
import { StudentFields, studentSchema, toApi, type StudentValues } from "@/components/academics/student-fields";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FileList, PhotoUpload } from "@/components/common/files";
import { Field } from "@/components/common/field";
import { PermissionGate } from "@/components/common/permission-gate";
import { FamilyIllustration } from "@/components/illustrations";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { useCan } from "@/components/session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api/client";
import { UserFormDialog } from "@/components/users/user-dialogs";
import type { StudentDetail, StudentOption } from "@/lib/api/types";
import { formatDate, initials } from "@/lib/format";
import { useClasses, useStudent } from "@/lib/queries";

type Relationship = "father" | "mother" | "guardian";

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

function EditSheet({ student, open, onOpenChange }: { student: StudentDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const classes = useClasses(open);
  const [status, setStatus] = useState(student.status);
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, watch, setValue, reset, setError: setFieldError, formState: { errors } } = useForm<StudentValues>({
    resolver: zodResolver(studentSchema),
  });
  useEffect(() => {
    if (!open) return;
    reset({
      first_name: student.first_name, last_name: student.last_name, gender: student.gender, date_of_birth: student.date_of_birth,
      admission_no: student.admission_no, admission_date: student.admission_date, class_id: student.class_id, section_id: student.section_id,
      roll_no: student.roll_no ? String(student.roll_no) : "", blood_group: student.blood_group ?? "", address: student.address ?? "",
    });
    setStatus(student.status);
    setError(null);
  }, [open, student, reset]);

  const save = useMutation({
    mutationFn: (v: StudentValues) => api<StudentDetail>(`/students/${student.id}`, { method: "PATCH", body: { ...toApi(v), status } }),
    onSuccess: ({ data }) => {
      qc.setQueryData(["student", student.id], data);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Student updated");
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) {
        for (const [f, m] of Object.entries(e.fieldErrors)) setFieldError(f as keyof StudentValues, { message: m });
      } else setError(e instanceof ApiError ? e.message : "Could not save");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit student</SheetTitle>
          <SheetDescription>Changing the class moves the student; capacity and roll numbers are checked.</SheetDescription>
        </SheetHeader>
        <form id="edit-student" className="px-4" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          {classes.data ? (
            <StudentFields compact control={control} register={register} errors={errors} watch={watch} classes={classes.data} onClassChange={() => setValue("section_id", "")} />
          ) : <Skeleton className="h-80" />}
          <Field label="Status" className="mt-4" hint="Inactive and alumni students lose app access and free a plan seat.">
            {(a) => (
              <Select value={status} onValueChange={(v) => setStatus(v as StudentDetail["status"])}>
                <SelectTrigger id={a.id} className="w-full capitalize"><SelectValue>{status}</SelectValue></SelectTrigger>
                <SelectContent>{["active", "inactive", "alumni"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
          {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        </form>
        <SheetFooter>
          <Button type="submit" form="edit-student" loading={save.isPending} loadingText="Saving…">Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AddGuardianDialog({ student, open, onOpenChange }: { student: StudentDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [relationship, setRelationship] = useState<Relationship>("mother");
  const [np, setNp] = useState({ full_name: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setMode("existing"); setNp({ full_name: "", phone: "", email: "" }); setError(null); }
  }, [open]);

  const add = useMutation({
    mutationFn: (body: object) => api<{ temporary_password: string | null }>(`/students/${student.id}/guardians`, { method: "POST", body }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
      toast.success("Parent linked", data.temporary_password
        ? { description: `New account: ${np.email} / ${data.temporary_password}. They'll set their own password at first sign-in.`, duration: 20000 }
        : undefined);
    },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : "Could not link the parent"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a parent or guardian</DialogTitle>
          <DialogDescription>For {student.first_name} {student.last_name}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <div role="tablist" aria-label="Parent account" className="inline-flex rounded-lg border p-0.5">
            {(["existing", "new"] as const).map((m) => (
              <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "existing" ? "Existing parent" : "New parent"}
              </button>
            ))}
          </div>
          <Select value={relationship} onValueChange={(v) => setRelationship(v as Relationship)}>
            <SelectTrigger className="ml-auto h-9 w-32 capitalize" aria-label="Relationship"><SelectValue>{relationship}</SelectValue></SelectTrigger>
            <SelectContent>{(["mother", "father", "guardian"] as const).map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {mode === "existing" ? (
          <ParentPicker pickedIds={student.guardians.map((g) => g.user_id)} onPick={(u) => add.mutate({ user_id: u.id, relationship })} />
        ) : (
          <form id="np-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add.mutate({ new_parent: np, relationship }); }}>
            <Field label="Full name" required className="sm:col-span-2">{(a) => <Input {...a} value={np.full_name} onChange={(e) => setNp((p) => ({ ...p, full_name: e.target.value }))} />}</Field>
            <Field label="Phone" required>{(a) => <Input {...a} type="tel" value={np.phone} onChange={(e) => setNp((p) => ({ ...p, phone: e.target.value }))} />}</Field>
            <Field label="Email" required>{(a) => <Input {...a} type="email" value={np.email} onChange={(e) => setNp((p) => ({ ...p, email: e.target.value }))} />}</Field>
          </form>
        )}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {mode === "new" && (
          <DialogFooter>
            <Button type="submit" form="np-form" loading={add.isPending} loadingText="Creating account…"><UserPlus aria-hidden />Create and link</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentProfile({ id }: { id: string }) {
  const can = useCan();
  const manage = can("students.manage");
  const seeUsers = can("users.view");
  const student = useStudent(id);
  const [creatingLogin, setCreatingLogin] = useState(false);
  // The student as the "create login" dialog expects it; kept stable so the dialog doesn't reset while it's open.
  const d = student.data;
  const [sid, sname, sadm, sclass] = [d?.id, d ? `${d.first_name} ${d.last_name}` : "", d?.admission_no ?? "", d ? `${d.class_name} – ${d.section_name}` : ""];
  const asOption = useMemo<StudentOption | undefined>(
    () => (sid ? { id: sid, name: sname, admission_no: sadm, class_section: sclass, has_login: false } : undefined), [sid, sname, sadm, sclass]);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [unlinking, setUnlinking] = useState<{ user_id: string; full_name: string } | null>(null);

  const unlink = useMutation({
    mutationFn: (userId: string) => api(`/students/${id}/guardians/${userId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student", id] }); setUnlinking(null); toast.success("Parent unlinked"); },
    onError: (e) => { setUnlinking(null); toast.error(e instanceof ApiError ? e.message : "Could not unlink"); },
  });

  if (student.isLoading) return <div className="space-y-4"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (!student.data) return <EmptyState title="Student not found" description="They may have been removed, or belong to another school." />;
  const s = student.data;
  const age = differenceInYears(new Date(), parseISO(s.date_of_birth));

  return (
    <>
      <Link href="/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Students</Link>

      <FadeIn>
        <div className="aurora relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.23_0.055_264)] via-[oklch(0.28_0.065_263)] to-[oklch(0.34_0.07_258)] p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <PhotoUpload
              fileId={s.photo_file_id}
              purpose="student_photo"
              ownerId={s.id}
              canEdit={manage}
              onChanged={() => qc.invalidateQueries({ queryKey: ["student", s.id] })}
              className="size-20 rounded-2xl bg-white/15 font-heading text-3xl font-extrabold ring-2 ring-white/30 backdrop-blur"
              fallback={initials(`${s.first_name} ${s.last_name}`)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{s.first_name} {s.last_name}</h1>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-white/25">{s.status}</span>
              </div>
              <p className="mt-1 text-white/80">{s.class_name} · Section {s.section_name}{s.roll_no ? ` · Roll ${s.roll_no}` : ""}</p>
              <p className="mt-0.5 font-mono text-sm text-white/70">{s.admission_no}</p>
            </div>
            {manage && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-2 self-start rounded-lg bg-white/15 px-3.5 text-sm font-medium ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 active:scale-[0.97]">
                <Pencil className="size-4" aria-hidden />Edit details
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <Stagger className="grid gap-3 sm:grid-cols-2">
              <StaggerItem><Info icon={Cake} label="Date of birth" value={`${formatDate(s.date_of_birth)} · ${age} years`} /></StaggerItem>
              <StaggerItem><Info icon={Hash} label="Gender" value={<span className="capitalize">{s.gender}</span>} /></StaggerItem>
              <StaggerItem><Info icon={Star} label="Admitted on" value={formatDate(s.admission_date)} /></StaggerItem>
              <StaggerItem><Info icon={Droplet} label="Blood group" value={s.blood_group ?? "Not recorded"} /></StaggerItem>
              <StaggerItem className="sm:col-span-2"><Info icon={MapPin} label="Address" value={s.address ?? "Not recorded"} /></StaggerItem>
              <StaggerItem className="sm:col-span-2">
                <div className="flex items-center gap-3 rounded-xl border p-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="size-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">App login</p>
                    {s.user_id && seeUsers
                      ? <Link href={`/settings/users/${s.user_id}`} className="block truncate font-medium hover:underline">{s.login_email}</Link>
                      : <p className="truncate font-medium">{s.login_email ?? "No login yet"}</p>}
                  </div>
                  {!s.user_id && can("users.manage") && (
                    <Button size="sm" variant="outline" onClick={() => setCreatingLogin(true)}><UserPlus aria-hidden />Create login</Button>
                  )}
                  {s.user_id && seeUsers && (
                    <Link href={`/settings/users/${s.user_id}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>View account<ChevronRight aria-hidden /></Link>
                  )}
                </div>
              </StaggerItem>
            </Stagger>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Parents & guardians</CardTitle>
              <CardDescription>They see this student in the parent app</CardDescription>
            </div>
            {manage && s.guardians.length < 4 && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus aria-hidden />Add</Button>}
          </CardHeader>
          <CardContent>
            {s.guardians.length === 0 ? (
              <EmptyState
                className="py-6"
                illustration={<FamilyIllustration />}
                title="No parents linked"
                description="Link a parent so they can follow attendance, fees and homework."
                action={manage && <Button onClick={() => setAdding(true)}><UsersRound aria-hidden />Link a parent</Button>}
              />
            ) : (
              <ul className="space-y-3">
                {s.guardians.map((g) => (
                  <li key={g.user_id} className="card-lift flex items-center gap-3 rounded-xl border p-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(g.full_name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        {seeUsers
                          ? <Link href={`/settings/users/${g.user_id}`} className="rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{g.full_name}</Link>
                          : g.full_name}
                        {g.is_primary && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Primary</span>}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{g.relationship}</p>
                      {g.phone && <a href={`tel:${g.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="size-3" aria-hidden />{g.phone}</a>}
                    </div>
                    {manage && (
                      <Button variant="ghost" size="icon" aria-label={`Unlink ${g.full_name}`} onClick={() => setUnlinking(g)}><Unlink aria-hidden /></Button>
                    )}
                    {seeUsers && (
                      <Link href={`/settings/users/${g.user_id}`} aria-label={`Open ${g.full_name}'s details`}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}><ChevronRight aria-hidden /></Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <StudentRecords studentId={s.id} />

      {/* Library, bus, hostel, results, homework, requests, certificates... from every module the school uses. */}
      <div className="mt-6"><StudentOverviewSection studentId={s.id} /></div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Birth certificate, transfer certificate, Aadhaar, medical records. Parents can see these in the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileList purpose="student_document" ownerId={s.id} canUpload={manage} withLabel emptyText="No documents uploaded" />
        </CardContent>
      </Card>

      {manage && <EditSheet student={s} open={editing} onOpenChange={setEditing} />}
      {manage && <AddGuardianDialog student={s} open={adding} onOpenChange={setAdding} />}
      {can("users.manage") && !s.user_id && (
        <UserFormDialog open={creatingLogin} onOpenChange={setCreatingLogin} forStudent={asOption}
          onCreated={() => qc.invalidateQueries({ queryKey: ["student", s.id] })} />
      )}
      <ConfirmDialog
        open={Boolean(unlinking)}
        onOpenChange={(o) => !o && setUnlinking(null)}
        destructive
        pending={unlink.isPending}
        title={`Unlink ${unlinking?.full_name}?`}
        description="They will no longer see this student in the parent app. Their account stays active."
        confirmLabel="Unlink"
        onConfirm={() => unlinking && unlink.mutate(unlinking.user_id)}
      />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PermissionGate permission="students.view">
      <StudentProfile id={id} />
    </PermissionGate>
  );
}
