"use client";

import {
  Activity, ArrowRight, Building2, CalendarClock, CheckCircle2, Circle, Clock, CreditCard, Inbox, LayoutGrid, PartyPopper,
  Settings2, UserPlus, Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/common/stat-card";
import { UsageBar } from "@/components/common/usage-bar";
import { RolesDonut, SigninsChart } from "@/components/dashboard/charts";
import { useCan, useSession } from "@/components/session-provider";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import type { Lead } from "@/lib/api/types";
import { describeAudit } from "@/lib/audit-labels";
import { formatDateTime, greeting, roleLabel, timeAgo } from "@/lib/format";
import { modulesReviewed } from "@/lib/local-flags";
import { useAudit, useCurrentSchool, useDashboardSummary, useSchools, useUsers } from "@/lib/queries";
import { cn } from "@/lib/utils";

function Hero({ subtitle, children }: { subtitle: string; children?: React.ReactNode }) {
  const me = useSession();
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.3_0.08_264)] via-[oklch(0.4_0.14_258)] to-[oklch(0.5_0.13_220)] p-6 text-white shadow-lg sm:p-8 dark:from-[oklch(0.22_0.05_264)] dark:via-[oklch(0.3_0.1_258)] dark:to-[oklch(0.36_0.1_220)]">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(closest-side,oklch(0.8_0.15_160/0.35),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-[radial-gradient(closest-side,oklch(0.75_0.14_230/0.3),transparent)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-white/75">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting()}, {me.full_name.split(" ")[0]}</h1>
          <p className="mt-1.5 text-white/80">{subtitle}</p>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

const heroButton = "inline-flex h-9 items-center gap-2 rounded-lg bg-white/15 px-3.5 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25 outline-none focus-visible:ring-2 focus-visible:ring-white";

function WelcomeBanner() {
  const params = useSearchParams();
  if (params.get("welcome") !== "1") return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
      <PartyPopper className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">Your school is ready!</p>
        <p className="text-muted-foreground">Your free trial has started. Complete the steps below to set things up, and add your staff when you&apos;re ready.</p>
      </div>
    </div>
  );
}

function SetupChecklist() {
  const can = useCan();
  const school = useCurrentSchool();
  const users = useUsers({ page: 1, page_size: 1 }, can("users.view"));
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => setReviewed(modulesReviewed.get()), []);
  const steps = [
    { done: Boolean(school.data?.phone && school.data?.address), label: "Complete the school profile", detail: "Contact details appear on receipts and certificates.", href: "/settings/school", show: can("school.view") },
    { done: reviewed, label: "Choose the modules you need", detail: "Switch off anything you won't use to keep menus simple.", href: "/settings/modules", show: can("modules.manage") },
    { done: (users.data?.meta?.total ?? 0) > 1, label: "Add your staff", detail: "Create accounts for principals, teachers and office staff.", href: "/settings/users", show: can("users.view") },
  ].filter((s) => s.show);
  if (!steps.length) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Set up your school</CardTitle>
          <span className="text-xs font-medium text-muted-foreground tabular">{done}/{steps.length} done</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {steps.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                {school.isLoading ? <Skeleton className="mt-0.5 size-5 rounded-full" />
                  : s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Done" />
                  : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="To do" />}
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through")}>{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.detail}</span>
                </span>
                <ArrowRight className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  const audit = useAudit({ page: 1, page_size: 6 });
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest changes across your school</CardDescription>
        </div>
        <Link href="/settings/audit" className="text-sm font-medium text-primary hover:underline">View all</Link>
      </CardHeader>
      <CardContent>
        {audit.isLoading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : !audit.data?.data.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[3px] before:w-px before:bg-border">
            {audit.data.data.map((e) => (
              <li key={e.id} className="relative flex items-start gap-3 pl-5">
                <span className="absolute top-1.5 left-0 size-[7px] rounded-full bg-primary ring-4 ring-card" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p><span className="font-medium">{e.user_name ?? "System"}</span> <span className="text-muted-foreground">{describeAudit(e.action, e.meta, e.entity_id).toLowerCase()}</span></p>
                  <time className="text-xs text-muted-foreground" dateTime={e.created_at} title={formatDateTime(e.created_at)}>{timeAgo(e.created_at)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function SchoolDashboard() {
  const me = useSession();
  const can = useCan();
  const summary = useDashboardSummary();
  const s = summary.data;
  const trial = me.school?.subscription_status === "trialing";

  return (
    <div className="space-y-6">
      <Hero subtitle={`${me.school?.name} · ${roleLabel(me.role)}`}>
        {can("users.manage") && <Link href="/settings/users" className={heroButton}><UserPlus className="size-4" aria-hidden />Add user</Link>}
        {can("school.manage") && <Link href="/settings/school" className={heroButton}><Settings2 className="size-4" aria-hidden />School profile</Link>}
        {can("billing.view") && <Link href="/settings/billing" className={heroButton}><CreditCard className="size-4" aria-hidden />{me.school?.plan.name} plan</Link>}
      </Hero>

      <Suspense><WelcomeBanner /></Suspense>

      {trial && s && (
        <Link href="/settings/billing" className="flex items-center gap-3 rounded-xl border border-info/30 bg-info/5 p-4 text-sm transition hover:border-info/50">
          <CalendarClock className="size-5 shrink-0 text-info" aria-hidden />
          <span className="flex-1">
            <span className="font-semibold">{s.trial_days_left > 0 ? `${s.trial_days_left} days left in your free trial` : "Your free trial has ended"}</span>{" "}
            <span className="text-muted-foreground">You&apos;re trying the {s.plan.name} plan. Compare plans any time.</span>
          </span>
          <ArrowRight className="size-4 text-info" aria-hidden />
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active accounts" value={s?.active_users ?? 0} loading={summary.isLoading} icon={Users} hint="Staff, parents and students" href={can("users.view") ? "/settings/users" : undefined} />
        <StatCard label="Sign-ins" value={s?.signins_total ?? 0} loading={summary.isLoading} icon={Activity} accent="info" hint="Last 14 days" />
        <StatCard label="Modules on" value={s ? `${s.modules_enabled} / ${s.modules_in_plan}` : "—"} loading={summary.isLoading} icon={LayoutGrid} accent="success" hint={`Included in ${s?.plan.name ?? "your"} plan`} href={can("modules.manage") ? "/settings/modules" : undefined} />
        <StatCard
          label="Staff seats"
          value={s ? (s.staff.limit === null ? `${s.staff.used}` : `${s.staff.used} / ${s.staff.limit}`) : "—"}
          loading={summary.isLoading}
          icon={CreditCard}
          accent={s && s.staff.limit !== null && s.staff.used / s.staff.limit >= 0.8 ? "warning" : "primary"}
          hint={s?.staff.limit === null ? "Unlimited on your plan" : "Used of your plan's limit"}
          href={can("billing.view") ? "/settings/billing" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sign-in activity</CardTitle>
            <CardDescription>How many times people signed in each day</CardDescription>
          </CardHeader>
          <CardContent>{s ? <SigninsChart data={s.signins} /> : <Skeleton className="h-64 w-full" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>People by role</CardTitle>
            <CardDescription>Active accounts at your school</CardDescription>
          </CardHeader>
          <CardContent>{s ? <RolesDonut data={s.roles} /> : <Skeleton className="h-44 w-full" />}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SetupChecklist />
        {can("audit.view") && <RecentActivity />}
        {s && (
          <Card>
            <CardHeader>
              <CardTitle>Plan usage</CardTitle>
              <CardDescription>{s.plan.name} plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <UsageBar label="Students" used={s.students.used} limit={s.students.limit} />
              <UsageBar label="Staff accounts" used={s.staff.used} limit={s.staff.limit} />
              {can("billing.view") && (
                <Link href="/settings/billing" className={buttonVariants({ variant: "outline", className: "w-full" })}>Compare plans</Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PlatformDashboard() {
  const all = useSchools({ page: 1, page_size: 1 });
  const active = useSchools({ page: 1, page_size: 1, is_active: true });
  const leads = useQuery({ queryKey: ["platform", "leads", "new"], queryFn: () => api<Lead[]>("/platform/leads", { query: { status: "new", page_size: 5 } }) });
  const newest = all.data?.data[0];
  return (
    <div className="space-y-6">
      <Hero subtitle="Platform overview">
        <Link href="/platform/schools" className={heroButton}><Building2 className="size-4" aria-hidden />Schools</Link>
        <Link href="/platform/leads" className={heroButton}><Inbox className="size-4" aria-hidden />Leads</Link>
      </Hero>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Schools" value={all.data?.meta?.total ?? 0} loading={all.isLoading} icon={Building2} href="/platform/schools" />
        <StatCard label="Active schools" value={active.data?.meta?.total ?? 0} loading={active.isLoading} icon={CheckCircle2} accent="success"
          hint={all.data && active.data ? `${all.data.meta!.total - active.data.meta!.total} suspended` : undefined} />
        <StatCard label="New leads" value={leads.data?.meta?.total ?? 0} loading={leads.isLoading} icon={Inbox} accent="warning" href="/platform/leads" hint="Waiting for a reply" />
        <StatCard label="Newest school" value={newest?.name ?? "—"} loading={all.isLoading} icon={Clock} accent="info" hint={newest ? `Added ${timeAgo(newest.created_at)}` : undefined} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div><CardTitle>Latest enquiries</CardTitle><CardDescription>From the website and schools asking to upgrade</CardDescription></div>
          <Link href="/platform/leads" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {!leads.data?.data.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No new enquiries.</p>
          ) : (
            <ul className="divide-y">
              {leads.data.data.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="flex-1"><span className="font-medium">{l.name}</span> <span className="text-muted-foreground">· {l.school_name ?? l.email}</span></span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{l.kind}</span>
                  <time className="w-24 text-right text-xs text-muted-foreground" dateTime={l.created_at}>{timeAgo(l.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const me = useSession();
  return me.role === "super_admin" ? <PlatformDashboard /> : <SchoolDashboard />;
}
