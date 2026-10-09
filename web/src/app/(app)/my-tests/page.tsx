"use client";

import { format, parseISO } from "date-fns";
import { ClipboardList, Play } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { useSession } from "@/components/session-provider";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyTest } from "@/lib/api/types";
import { useMyTests } from "@/lib/queries";
import { cn } from "@/lib/utils";

const LABEL: Record<MyTest["state"], [string, string]> = {
  upcoming: ["Opens soon", "bg-info/10 text-info"], open: ["Open now", "bg-success/10 text-success"], in_progress: ["In progress", "bg-warning/10 text-warning"],
  submitted: ["Submitted", "bg-primary/10 text-primary"], missed: ["Missed", "bg-muted text-muted-foreground"],
};

export default function MyTestsPage() {
  const me = useSession();
  const q = useMyTests();
  const student = me.role === "student";
  return (
    <>
      <PageHeader title="Online tests" description={student ? "Tests from your teachers. Once you start, the timer keeps running." : "Your children's online tests and scores."} />
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<ClipboardList className="size-12 text-muted-foreground/60" aria-hidden />} title="No tests yet" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {q.data.map((t) => {
            const [label, tone] = LABEL[t.state];
            return (
              <li key={`${t.test_id}-${t.student_id}`} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{t.title}</p>
                  <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", tone)}>{label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.subject_name}{!student && ` · ${t.student_name}`} · {t.questions} questions · {t.duration_minutes} min</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(t.opens_at), "d MMM, h:mm a")} – {format(parseISO(t.closes_at), "d MMM, h:mm a")}</p>
                {t.released && t.score != null && <p className="mt-2 text-sm font-semibold">Score {t.score} of {t.max_marks} ({t.percent}%)</p>}
                {t.state === "submitted" && !t.released && <p className="mt-2 text-xs text-muted-foreground">Results will show when the teacher releases them.</p>}
                <div className="mt-3">
                  {student && (t.state === "open" || t.state === "in_progress") && (
                    <Link href={`/my-tests/${t.test_id}`} className={buttonVariants({ size: "sm" })}><Play aria-hidden />{t.state === "open" ? "Start test" : "Continue"}</Link>
                  )}
                  {t.state === "submitted" && t.released && <Link href={`/my-tests/${t.test_id}?student=${t.student_id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>See answers</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
