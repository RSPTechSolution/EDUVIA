"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Turns a paged list into a growing one: each page the server returns is kept, and the next page is added under it.
 * Starts over when page 1 comes back or the total changes (a new search or filter). Pages are stored by number, so
 * a page fetched again after a change replaces its old copy instead of repeating it.
 */
export function useLoadMore<T>(data: T[] | undefined, meta: PageMeta | null | undefined, getId: (row: T) => string) {
  const [pages, setPages] = useState<Map<number, T[]>>(new Map());
  const total = useRef<number | undefined>(undefined);
  const idOf = useRef(getId);
  idOf.current = getId;

  useEffect(() => {
    if (!data || !meta) return;
    setPages((prev) => {
      const fresh = meta.page === 1 || total.current !== meta.total;
      const next = new Map(fresh ? [] : prev);
      next.set(meta.page, data);
      return next;
    });
    total.current = meta.total;
  }, [data, meta]);

  const seen = new Set<string>();
  const rows: T[] = [];
  for (const [, list] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
    for (const r of list) {
      const id = idOf.current(r);
      if (!seen.has(id)) {
        seen.add(id);
        rows.push(r);
      }
    }
  }
  const lastPage = pages.size ? Math.max(...pages.keys()) : meta?.page ?? 1;
  // Until the first page lands, show what the query has.
  const shown = pages.size ? rows : data ?? [];
  return { rows: shown, total: meta?.total ?? shown.length, hasMore: meta ? lastPage * meta.page_size < meta.total : false, nextPage: lastPage + 1 };
}

/** "Load more" under a list, with how many are showing. Announced to screen readers as the list grows. */
export function LoadMore({ shown, total, hasMore, loading, onLoadMore, noun = "items", className }: {
  shown: number; total: number; hasMore: boolean; loading?: boolean; onLoadMore: () => void; noun?: string; className?: string;
}) {
  if (!total) return null;
  return (
    <div className={cn("flex flex-col items-center gap-2 py-4", className)}>
      <p className="text-xs text-muted-foreground tabular" aria-live="polite">
        Showing {shown.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} {noun}
      </p>
      {hasMore && (
        <Button variant="outline" onClick={onLoadMore} loading={loading} loadingText="Loading…" className="min-w-36">
          Load more<ChevronDown aria-hidden />
        </Button>
      )}
    </div>
  );
}
