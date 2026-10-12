"use client";

import {
  Award, BedDouble, BookOpen, Briefcase, Bus, CalendarDays, CalendarOff, ClipboardList, DoorOpen, FileBadge2, GraduationCap, Handshake,
  Laptop, Library, Route, UsersRound, Video,
} from "lucide-react";
import Link from "next/link";
import { PercentBadge } from "@/components/attendance/status";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibrarySummary, PersonExtras, PtmRow, RequestRow, StudentOverview } from "@/lib/api/types";
import { formatDate, formatDateTime, formatMoney, inr } from "@/lib/format";
import { useStudentOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** A titled card for one module's part of a profile. */
function Section({ icon: Icon, title, description, action, children, className }: {
  icon: React.ElementType; title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Icon className="size-4 text-primary" aria-hidden />{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;
const More = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="shrink-0 text-sm font-medium text-primary hover:underline">{children}</Link>
);

export function LibraryCard({ lib, href = "/library" }: { lib: LibrarySummary; href?: string }) {
  return (
    <Section icon={Library} title="Library" description={`${lib.current.length} on loan · ${lib.returned_total} returned${lib.fines_due > 0 ? ` · ${inr(lib.fines_due)} fine due` : ""}`}
      action={<More href={href}>Library</More>}>
      {lib.current.length === 0 ? <Empty>No books on loan.</Empty> : (
        <ul className="divide-y">
          {lib.current.map((b) => (
            <li key={b.accession_no} className="flex items-start gap-3 py-2.5 first:pt-0">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{b.title}</span>
                <span className="block text-xs text-muted-foreground">{b.author ? `${b.author} · ` : ""}No. {b.accession_no} · since {formatDate(b.issued_on, "d MMM")}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", b.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                {b.overdue ? "Overdue" : `Due ${formatDate(b.due_on, "d MMM")}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {lib.recent_returns.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Recently returned: {lib.recent_returns.map((b) => b.title).join(", ")}</p>
      )}
    </Section>
  );
}

export function RequestsCard({ rows, title = "Leave and gate passes", description, showStudent = false }: {
  rows: RequestRow[]; title?: string; description?: string; showStudent?: boolean;
}) {
  return (
    <Section icon={CalendarOff} title={title} description={description}>
      {rows.length === 0 ? <Empty>No requests yet.</Empty> : (
        <ul className="divide-y">
          {rows.map((r, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0">
              {r.kind === "gate_pass" ? <DoorOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> : <CalendarOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{r.title}{showStudent && r.student_name ? <span className="font-normal text-muted-foreground"> · {r.student_name}</span> : null}</span>
                {r.detail && <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>}
              </span>
              <StatusBadge status={r.status} label={r.status.replace("_", " ")} className="shrink-0 capitalize" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function PtmCard({ rows }: { rows: PtmRow[] }) {
  return (
    <Section icon={Handshake} title="Parent-teacher meetings" description="Coming up" action={<More href="/ptm">Meetings</More>}>
      {rows.length === 0 ? <Empty>No meetings booked.</Empty> : (
        <ul className="space-y-2">
          {rows.map((m, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{m.title}</span> <span className="text-muted-foreground">· {[m.student_name, m.teacher_name].filter(Boolean).join(" with ")}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground tabular">{formatDate(m.on, "d MMM")} · {m.slot}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Everything about a student from the other modules, as cards. Only the modules the school uses appear. */
export function StudentOverviewCards({ o, studentId, family = false }: { o: StudentOverview; studentId: string; family?: boolean }) {
  // Families open their own pages (my-results, my-library), not the office's.
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {o.library && <LibraryCard lib={o.library} href={family ? "/my-library" : "/library"} />}
      {(o.bus || o.hostel) && (
        <Section icon={o.bus ? Bus : BedDouble} title={o.bus && o.hostel ? "Transport and hostel" : o.bus ? "Transport" : "Hostel"}>
          <div className="space-y-4 text-sm">
            {o.bus && (
              <div className="flex items-start gap-3">
                <Route className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">{o.bus.route}</p>
                  <p className="text-muted-foreground">{o.bus.stop ? `Stop: ${o.bus.stop}` : "No stop set"}{o.bus.pickup_time ? ` · pick-up ${o.bus.pickup_time}` : ""}{o.bus.drop_time ? ` · drop ${o.bus.drop_time}` : ""}</p>
                  {(o.bus.vehicle_number || o.bus.driver_name) && (
                    <p className="text-muted-foreground">{[o.bus.vehicle_number, o.bus.driver_name].filter(Boolean).join(" · ")}
                      {o.bus.driver_phone && <> · <a href={`tel:${o.bus.driver_phone}`} className="text-primary hover:underline">{o.bus.driver_phone}</a></>}</p>
                  )}
                </div>
              </div>
            )}
            {o.hostel && (
              <div className="flex items-start gap-3">
                <BedDouble className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div><p className="font-medium">{o.hostel.hostel}, room {o.hostel.room}</p><p className="text-muted-foreground">{o.hostel.floor ? `${o.hostel.floor} floor · ` : ""}since {formatDate(o.hostel.since)}</p></div>
              </div>
            )}
          </div>
        </Section>
      )}
      {o.results && (
        <Section icon={Award} title="Exam results" description="Published exams">
          {o.results.length === 0 ? <Empty>No published results yet.</Empty> : (
            <ul className="divide-y">
              {o.results.map((r) => (
                <li key={r.exam_id}>
                  <Link href={family ? "/my-results" : `/exams/${r.exam_id}/report/${studentId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                    <GraduationCap className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{r.name}</span> <span className="text-muted-foreground">· {r.papers} papers{r.absent ? ` · absent in ${r.absent}` : ""}</span></span>
                    <PercentBadge value={r.percent} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {o.homework && (
        <Section icon={ClipboardList} title="Homework" description="This session, for the student's class">
          <div className="grid grid-cols-4 gap-2 text-center">
            {([["To do", o.homework.pending, ""], ["Overdue", o.homework.overdue, "text-destructive"], ["Done", o.homework.done, ""], ["Checked", o.homework.checked, "text-success"]] as const).map(([label, n, tone]) => (
              <div key={label} className="rounded-xl border p-3">
                <p className={cn("font-heading text-2xl font-bold tabular", n ? tone : "text-muted-foreground")}>{n}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      <RequestsCard rows={o.requests} />
      {o.tests && o.tests.length > 0 && (
        <Section icon={Laptop} title="Online tests">
          <ul className="divide-y">
            {o.tests.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                <span className="min-w-0 truncate font-medium">{t.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.submitted_at ? (t.needs_marking ? "Being marked" : `Score ${t.score ?? "—"}`) : "Not submitted"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {o.certificates && (
        <Section icon={FileBadge2} title="Certificates" action={family ? undefined : <More href="/certificates">Certificates</More>}>
          {o.certificates.length === 0 ? <Empty>None issued.</Empty> : (
            <ul className="space-y-2 text-sm">
              {o.certificates.map((c) => <li key={c.serial_no} className="flex justify-between gap-3"><span className="capitalize">{c.kind.replace("_", " ")} <span className="font-mono text-xs text-muted-foreground">{c.serial_no}</span></span><span className="text-muted-foreground">{formatDate(c.issued_on)}</span></li>)}
            </ul>
          )}
        </Section>
      )}
      {o.ptm && o.ptm.length > 0 && <PtmCard rows={o.ptm} />}
      {o.siblings.length > 0 && (
        <Section icon={UsersRound} title="Brothers and sisters" description="In this school, with the same parents">
          <ul className="space-y-2">
            {o.siblings.map((s) => (
              <li key={s.student_id}>{family ? <span className="text-sm font-medium">{s.name}</span> : <Link href={`/students/${s.student_id}`} className="text-sm font-medium hover:underline">{s.name}</Link>} <span className="text-sm text-muted-foreground">· {s.class_section}</span></li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

/** Loads and shows a student's overview, with placeholders the size of the cards while it loads. */
export function StudentOverviewSection({ studentId }: { studentId: string }) {
  const q = useStudentOverview(studentId);
  if (q.isLoading) return <div className="grid gap-6 lg:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>;
  if (!q.data) return null;
  return <StudentOverviewCards o={q.data} studentId={studentId} />;
}

/** What a staff member, driver or parent has to do with the other modules. */
export function PersonSections({ p, self = false }: { p: PersonExtras; self?: boolean }) {
  const cards: React.ReactNode[] = [];
  if (p.hr) {
    cards.push(
      <Section key="hr" icon={Briefcase} title={self ? "My work" : "Work"} description="This month" action={<More href={self ? "/my-hr" : "/hr"}>{self ? "Leave and pay" : "HR"}</More>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([["Present", p.hr.present_days], ["Absent", p.hr.absent_days], ["On leave", p.hr.leave_days]] as const).map(([l, n]) => (
            <div key={l} className="rounded-xl border p-3"><p className="font-heading text-2xl font-bold tabular">{n}</p><p className="text-xs text-muted-foreground">{l} days</p></div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {[p.hr.department && `${p.hr.department} department`, p.hr.joined_on && `joined ${formatDate(p.hr.joined_on)}`, p.hr.qualification].filter(Boolean).join(" · ") || "No HR details yet."}
          {p.hr.latest_payslip && <> · Last payslip ({p.hr.latest_payslip.month}): <span className="font-medium text-foreground">{formatMoney(p.hr.latest_payslip.net)}</span></>}
        </p>
        {p.hr.requests.length > 0 && (
          <ul className="mt-3 divide-y border-t">
            {p.hr.requests.map((r, i) => <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{r.detail}</span><StatusBadge status={r.status} label={r.status} className="shrink-0 capitalize" /></li>)}
          </ul>
        )}
      </Section>,
    );
  }
  if (p.buses.length > 0 || p.trips.length > 0) {
    cards.push(
      <Section key="bus" icon={Bus} title="Bus duty" action={<More href={self ? "/my-transport" : "/transport"}>Transport</More>}>
        <ul className="space-y-2 text-sm">
          {p.buses.map((b) => <li key={b.vehicle_number}><span className="font-medium">{b.vehicle_number}</span> <span className="text-muted-foreground">· {b.routes.join(", ") || "No route"}{b.helper ? ` · helper ${b.helper}` : ""}</span></li>)}
        </ul>
        {p.trips.length > 0 && (
          <ul className="mt-3 divide-y border-t text-sm">
            {p.trips.map((t, i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{t.route} <span className="text-muted-foreground">· {t.direction === "pickup" ? "to school" : "home"}</span></span><span className="text-muted-foreground">{formatDateTime(t.started_at)}</span></li>)}
          </ul>
        )}
      </Section>,
    );
  }
  if (p.live_classes.length > 0 || p.lesson_plans_this_week > 0 || p.covers_ahead > 0) {
    cards.push(
      <Section key="teach" icon={Video} title="Teaching" description={`${p.lesson_plans_this_week} lesson plans this week · ${p.covers_ahead} cover periods ahead`}>
        {p.live_classes.length === 0 ? <Empty>No live classes coming up.</Empty> : (
          <ul className="space-y-2 text-sm">
            {p.live_classes.map((l, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate"><span className="font-medium">{l.title}</span> <span className="text-muted-foreground">· {l.sections.join(", ")}</span></span><span className="shrink-0 text-muted-foreground">{formatDateTime(l.starts_at)}</span></li>)}
          </ul>
        )}
      </Section>,
    );
  }
  if (p.library) cards.push(<LibraryCard key="lib" lib={p.library} href={self ? "/my-library" : "/library"} />);
  if (p.requests.length > 0) cards.push(<RequestsCard key="req" rows={p.requests} title="Children's leave and gate passes" showStudent />);
  if (p.ptm.length > 0) cards.push(<PtmCard key="ptm" rows={p.ptm} />);
  if (p.visitors.length > 0 || p.warden_of.length > 0) {
    cards.push(
      <Section key="campus" icon={DoorOpen} title={p.visitors.length ? "Visitors" : "Hostel"} description={p.warden_of.length ? `Warden of ${p.warden_of.join(", ")}` : undefined}>
        {p.visitors.length === 0 ? <Empty>No visitors.</Empty> : (
          <ul className="divide-y text-sm">
            {p.visitors.map((v, i) => <li key={i} className="flex items-center justify-between gap-3 py-2 first:pt-0"><span className="min-w-0 truncate"><span className="font-medium">{v.name}</span> <span className="text-muted-foreground">· {v.purpose}</span></span><span className="shrink-0 text-xs text-muted-foreground capitalize">{v.status.replace("_", " ")}</span></li>)}
          </ul>
        )}
      </Section>,
    );
  }
  if (cards.length === 0) return null;
  return <div className="grid gap-6 lg:grid-cols-2">{cards}</div>;
}
