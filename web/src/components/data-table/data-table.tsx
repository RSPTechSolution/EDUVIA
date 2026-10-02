'use client';
import {
  flexRender, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel,
  useReactTable, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns:     ColumnDef<TData, TValue>[];
  data:        TData[];
  searchable?: boolean;
  searchKey?:  string;
  searchPlaceholder?: string;
  loading?:    boolean;
  emptyMessage?: string;
  toolbar?:    React.ReactNode;
  className?:  string;
}

export function DataTable<TData, TValue>({
  columns, data, searchable = true, searchKey, searchPlaceholder = 'Search...',
  loading, emptyMessage = 'No records found.', toolbar, className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data, columns,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: { sorting, globalFilter },
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className={cn('space-y-4', className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm" role="grid">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border bg-muted/30">
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          'h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                          canSort && 'cursor-pointer select-none hover:text-foreground',
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span aria-hidden>
                              {sorted === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> :
                               sorted === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> :
                               <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {columns.map((_, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" style={{ width: `${60 + Math.random()*30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="h-48 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}
                    className="border-b border-border/50 transition-colors hover:bg-muted/30 data-[state=selected]:bg-accent/50"
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-border px-4 py-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of{' '}
            {table.getFilteredRowModel().rows.length} records
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">Previous</Button>
            <span className="text-xs text-muted-foreground">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
