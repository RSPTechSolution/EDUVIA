"use client";

import { ArrowRight, Building2, CheckCircle2, Circle, Clock, LayoutGrid, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { useCan, useSession } from "@/components/session-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { describeAudit } from "@/lib/audit-labels";
import { formatDateTime, greeting, roleLabel, timeAgo } from "@/lib/format";
import { useAudit, useCurrentSchool, useSchools, useUsers } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { modulesReviewed } from "@/lib/local-flags";

const TOTAL_MODULES = 16;

function SetupChecklist() {
  const can = useCan();
  const school = useCurrentSchool();
  const users = useUsers({ page: 1, page_size: 1 }, can("users.view"));
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => setReviewed(modulesReviewed.get()), []);
  const steps = [
    {
      done: Boolean(school.data?.phone && school.data?.address),
      label: "Complete the school profile",
      detail: "Address and contact details appear on receipts and certificates.",
      href: "/settings/school",
      show: can("school.view"),
    },
    {
      done: reviewed,
      label: "Choose the modules you need",
      detail: "Turn off anything your school won't use to keep menus simple.",
      href: "/settings/modules",
      show: can("modules.manage"),
    },
    {
      done: (users.data?.meta?.total ?? 0) > 1,
      label: "Add your staff",
      detail: "Create accounts for principals, teachers and office staff.",
      href: "/settings/users",
      show: can("users.view"),
    },
  ].filter((s) => s.show);
  if (!steps.length) return null;
  const loading = school.isLoading || users.isLoading;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your school</CardTitle>
        <CardDescription>A few steps to get EDUVIA ready for everyone.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {steps.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                {loading ? (
                  <Skeleton className="mt-0.5 size-5 rounded-full" />
                ) : s.done ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="To do" />
                )}
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
      <CardHeader className="flex flex-row items-center justify-between">
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
          <ul className="space-y-3.5">
            {audit.data.data.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p>
                    <span className="font-medium">{e.user_name ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">{describeAudit(e.action, e.meta, e.entity_id).toLowerCase()}</span>
                  </p>
                  <time className="text-xs text-muted-foreground" dateTime={e.created_at} title={formatDateTime(e.created_at)}>
                    {timeAgo(e.created_at)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SchoolDashboard() {
  const me = useSession();
  const can = useCan();
  const users = useUsers({ page: 1, page_size: 1, is_active: true }, can("users.view"));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {can("users.view") && (
          <StatCard label="Active accounts" value={users.data?.meta?.total ?? 0} loading={users.isLoading}
            hint="Staff, parents and students" icon={Users} href="/settings/users" />
        )}
        <StatCard label="Modules enabled" value={`${me.modules.length} / ${TOTAL_MODULES}`} icon={LayoutGrid} accent="info"
          hint="Features available to your school" href={can("modules.manage") ? "/settings/modules" : undefined} />
        <StatCard label="Your role" value={roleLabel(me.role)} icon={ShieldCheck} accent="success"
          hint={`Last sign-in ${me.last_login_at ? timeAgo(me.last_login_at) : "—"}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SetupChecklist />
        {can("audit.view") && <RecentActivity />}
      </div>
    </>
  );
}

function PlatformDashboard() {
  const all = useSchools({ page: 1 });
  const schools = all.data?.data ?? [];
  const active = schools.filter((s) => s.is_active).length;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Schools" value={all.data?.meta?.total ?? 0} loading={all.isLoading} icon={Building2} href="/platform/schools" />
        <StatCard label="Active on this page" value={active} loading={all.isLoading} icon={CheckCircle2} accent="success" />
        <StatCard label="Newest school" value={schools[0]?.name ?? "—"} loading={all.isLoading} icon={Clock} accent="info"
          hint={schools[0] ? `Added ${timeAgo(schools[0].created_at)}` : undefined} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const me = useSession();
  const firstName = me.full_name.split(" ")[0];
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={me.school ? `${me.school.name} · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}` : "Platform overview"}
      />
      {me.role === "super_admin" ? <PlatformDashboard /> : <SchoolDashboard />}
    </>
  );
}
