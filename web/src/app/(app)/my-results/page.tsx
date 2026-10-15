"use client";

import { format, parseISO } from "date-fns";
import { Award, CalendarDays, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { GradeBadge, KIND } from "@/components/exams/shared";
import { PageHeader } from "@/components/common/page-header";
import { FamilyIllustration } from "@/components/illustrations";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { colorOf } from "@/components/timetable/grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyResults } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function MyResultsPage() {
  const q = useMyResults();
  const [index, setIndex] = useState(0);
  const kids = q.data ?? [];
  const c = kids[Math.min(index, kids.length - 1)];
  return (
    <>
      <PageHeader title="Results" description="Report cards appear here once the school publishes them." />
      {q.isLoading ? <Skeleton className="h-80 rounded-2xl" /> : !c ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<FamilyIllustration />} title="Nothing to show yet" />
      ) : (
        <>
          {kids.length > 1 && (
            <div role="tablist" aria-label="Child" className="mb-5 flex flex-wrap gap-2">
              {kids.map((k, i) => (
                <button key={k.student_id} role="tab" type="button" aria-selected={i === index} onClick={() => setIndex(i)}
                  className={cn("rounded-xl border px-4 py-2 text-left transition", i === index ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40")}>
                  <span className="block text-sm font-semibold">{k.name}</span><span className="block text-xs text-muted-foreground">{k.class_section}</span>
                </button>
              ))}
            </div>
          )}
          <FadeIn key={c.student_id} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              {c.exams.length === 0 ? <EmptyState className="rounded-2xl border bg-card" title="No results published yet" /> : (
                <Stagger className="space-y-3">
                  {c.exams.map((e) => (
                    <StaggerItem key={e.exam_id}>
                      <Link href={`/exams/${e.exam_id}/report/${c.student_id}`} className="card-lift group flex items-center gap-4 rounded-2xl border bg-card p-5">
                        <span className={cn("flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl", e.passed ? "bg-success/12 text-success" : "bg-warning/12 text-warning")}>
                          {e.rank && e.rank <= 3 ? <Trophy className="size-6" aria-hidden /> : <Award className="size-6" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-heading text-lg font-bold group-hover:text-primary">{e.exam_name}</span>
                          <span className="block text-sm text-muted-foreground">{KIND[e.kind]} · published {format(parseISO(e.published_at), "d MMM yyyy")}</span>
                          <span className="mt-1 block text-sm">{e.rank ? <>Rank <span className="font-semibold">{e.rank}</span> of {e.class_size}</> : null}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-heading text-2xl font-semibold tabular">{e.percent ?? "—"}%</span>
                          <GradeBadge grade={e.grade} />
                        </span>
                        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                      </Link>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </div>
            <Card className="self-start">
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden />Upcoming exams</CardTitle></CardHeader>
              <CardContent>
                {c.upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No exams scheduled.</p> : (
                  <ol className="space-y-2">
                    {c.upcoming.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 text-sm">
                        <span className="w-16 shrink-0 text-xs text-muted-foreground tabular">{p.exam_date ? format(parseISO(p.exam_date), "EEE d MMM") : "TBA"}</span>
                        <span className={cn("size-2 shrink-0 rounded-full", colorOf(p.subject_color).dot)} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{p.subject_name}</span>
                        <span className="text-xs text-muted-foreground tabular">/{p.max_marks}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </>
      )}
    </>
  );
}
