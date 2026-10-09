"use client";

import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, inr } from "@/lib/format";
import { useMyBooks } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function MyLibraryPage() {
  const q = useMyBooks();
  const out = (q.data ?? []).filter((i) => !i.returned_on);
  const past = (q.data ?? []).filter((i) => i.returned_on);
  return (
    <>
      <PageHeader title="Library books" description="Books borrowed from the school library, with due dates and any late fines." />
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : !q.data?.length ? (
        <EmptyState className="rounded-2xl border bg-card" illustration={<BookOpen className="size-12 text-muted-foreground/60" aria-hidden />} title="No library books" description="Books borrowed from the library will show here." />
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {out.map((i) => (
              <li key={i.id} className={cn("rounded-xl border bg-card p-4", i.overdue_days > 0 && "border-destructive/50")}>
                <p className="font-semibold">{i.title}</p>
                <p className="text-sm text-muted-foreground">{i.borrower}{i.class_section ? ` · ${i.class_section}` : ""} · copy {i.accession_no}</p>
                <p className={cn("mt-2 text-sm font-medium", i.overdue_days > 0 ? "text-destructive" : "text-foreground")}>
                  {i.overdue_days > 0 ? `${i.overdue_days} days late · fine so far ${inr(i.fine)}` : `Return by ${formatDate(i.due_on)}`}
                </p>
              </li>
            ))}
          </ul>
          {!out.length && <p className="text-sm text-muted-foreground">Nothing borrowed right now.</p>}
          {past.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 font-heading text-lg font-bold">Returned</h2>
              <ul className="divide-y rounded-2xl border bg-card text-sm">
                {past.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="font-medium">{i.title}</span>
                    <span className="text-muted-foreground">{i.borrower}</span>
                    <span className="ml-auto text-muted-foreground">Returned {formatDate(i.returned_on)}{i.fine > 0 ? ` · fine ${inr(i.fine)} ${i.fine_paid ? "paid" : "due"}` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
