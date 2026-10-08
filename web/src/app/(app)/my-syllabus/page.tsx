"use client";

import { AlertTriangle, BookMarked } from "lucide-react";
import { useState } from "react";
import { CoverageBar } from "@/components/academics/syllabus";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { FamilyIllustration } from "@/components/illustrations";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { colorOf } from "@/components/timetable/grid";
import { Skeleton } from "@/components/ui/skeleton";
import { useMySyllabus } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function MySyllabusPage() {
  const q = useMySyllabus();
  const [index, setIndex] = useState(0);
  const kids = q.data ?? [];
  const c = kids[Math.min(index, kids.length - 1)];
  return (
    <>
      <PageHeader title="Syllabus" description="How much of each subject the class has finished this year." />
      {q.isLoading ? <Skeleton className="h-64 rounded-2xl" /> : !c ? (
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
          {c.subjects.length === 0 ? (
            <EmptyState className="rounded-2xl border bg-card" title="No syllabus shared yet" description={`${c.class_section}'s teachers haven't added the syllabus.`} />
          ) : (
            <Stagger key={c.student_id} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.subjects.map((r) => (
                <StaggerItem key={r.subject_id}>
                  <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", colorOf(r.subject_color).cell)}>{r.subject_name}</span>
                      {r.behind > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" aria-hidden />{r.behind} behind</span>}
                    </div>
                    <CoverageBar row={r} />
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <BookMarked className="size-3.5 shrink-0" aria-hidden />{r.last_topic ? `Latest: ${r.last_topic}` : "Not started yet"}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}
    </>
  );
}
