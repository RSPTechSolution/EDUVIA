"use client";

import { flexRender, tableFeatures, useTable, type ColumnDef, type RowData } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PageMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Paging, sorting and filtering happen on the server, so only the core features are needed.
const features = tableFeatures({});
export type Col<T extends RowData> = ColumnDef<typeof features, T>;

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3"];

interface DataTableProps<T extends RowData> {
  columns: Col<T>[];
  data: T[];
  /** Server-side pagination info. Omit for a single, unpaginated page. */
  meta?: PageMeta | null;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  /** Showing previous results while new ones load (search, filter, paging). */
  refreshing?: boolean;
  empty?: React.ReactNode;
  caption: string;
  getRowId?: (row: T) => string;
  /** Makes the whole row open this page. Keep a real link in the row too (e.g. on the name) for keyboards and screen readers. */
  rowHref?: (row: T) => string;
}

// Clicks on these inside a clickable row do their own thing instead of opening the row.
const INTERACTIVE = "a, button, input, select, textarea, label, [role=menuitem], [role=checkbox], [data-no-row-click]";

export function DataTable<T extends RowData>({ columns, data, meta, onPageChange, loading, refreshing, empty, caption, getRowId, rowHref }: DataTableProps<T>) {
  const router = useRouter();
  const table = useTable<typeof features, T>({
    features,
    data,
    columns,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.page_size)) : 1;
  const from = meta && meta.total ? (meta.page - 1) * meta.page_size + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.page_size, meta.total) : data.length;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-xs" aria-busy={loading || refreshing || undefined}>
      {refreshing && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/15" role="status" aria-label="Updating results">
          <div className="indeterminate-bar h-full w-1/3 rounded-full bg-primary" />
        </div>
      )}
      <div className={cn("overflow-x-auto transition-opacity duration-200", refreshing && "pointer-events-none opacity-55")}>
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} scope="col" className="h-10 px-4 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r} className="border-b last:border-0">
                  {columns.map((_, c) => (
                    <td key={c} className="px-4 py-3.5">
                      <Skeleton className={cn("h-4", SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length])} />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{empty ?? <p className="py-12 text-center text-muted-foreground">Nothing here yet.</p>}</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("border-b transition-colors last:border-0 hover:bg-muted/30", rowHref && "cursor-pointer")}
                  onClick={rowHref ? (e) => {
                    if ((e.target as HTMLElement).closest(INTERACTIVE) || window.getSelection()?.toString()) return;
                    const href = rowHref(row.original);
                    if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
                    else router.push(href);
                  } : undefined}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {meta && meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
          <p className="text-xs text-muted-foreground tabular" aria-live="polite">
            Showing {from}–{to} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={meta.page <= 1 || loading || refreshing} onClick={() => onPageChange?.(meta.page - 1)}>
              <ChevronLeft aria-hidden />Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular">Page {meta.page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={meta.page >= pages || loading || refreshing} onClick={() => onPageChange?.(meta.page + 1)}>
              Next<ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
