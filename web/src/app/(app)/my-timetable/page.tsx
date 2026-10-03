"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ClassesIllustration } from "@/components/illustrations";
import { FadeIn } from "@/components/motion/primitives";
import { useSession } from "@/components/session-provider";
import { DAY_NAMES, TimetableGrid, TodayList } from "@/components/timetable/grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyTimetables } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function MyTimetablePage() {
  const me = useSession();
  const views = useMyTimetables();
  const [index, setIndex] = useState(0);
  const view = views.data?.[index];
  const today = new Date().getDay();
  const isParent = me.role === "parent";

  return (
    <>
      <PageHeader
        title={isParent ? "Children's timetable" : "My timetable"}
        description={me.role === "teacher" || me.role === "principal" ? "Where you're teaching this week." : "The week's lessons, period by period."}
      />
      {views.isLoading ? <Skeleton className="h-[520px] rounded-xl" /> : !view ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClassesIllustration />} title="No timetable yet"
          description={isParent ? "Your children aren't linked yet, or their class has no timetable. Contact the school office." : "Nothing has been scheduled for you yet."} />
      ) : (
        <>
          {views.data!.length > 1 && (
            <div role="tablist" aria-label="Child" className="mb-5 flex flex-wrap gap-2">
              {views.data!.map((v, i) => (
                <button key={v.owner_id + v.title} role="tab" type="button" aria-selected={i === index} onClick={() => setIndex(i)}
                  className={cn("rounded-xl border px-4 py-2 text-left transition active:scale-[0.98]", i === index ? "border-primary bg-primary/10" : "bg-card hover:border-primary/40")}>
                  <span className="block text-sm font-semibold">{v.title}</span>
                  <span className="block text-xs text-muted-foreground">{v.subtitle}</span>
                </button>
              ))}
            </div>
          )}
          <FadeIn key={index} className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" aria-hidden />Today</CardTitle>
                <CardDescription>{today >= 1 && today <= 6 ? DAY_NAMES[today - 1] : "Sunday"} · {view.title}{view.subtitle && view.kind === "section" && isParent ? ` · ${view.subtitle}` : ""}</CardDescription>
              </CardHeader>
              <CardContent><TodayList view={view} day={today} /></CardContent>
            </Card>
            <div className="min-w-0">
              <h2 className="mb-3 font-heading text-lg font-bold">Week</h2>
              <TimetableGrid view={view} />
            </div>
          </FadeIn>
        </>
      )}
    </>
  );
}
