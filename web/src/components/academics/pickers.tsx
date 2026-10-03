"use client";

import { Check, Search, X } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import type { StudentOption, User } from "@/lib/api/types";
import { initials } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import { useStudentOptions, useUsers } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Type to search, pick from the results. Results are announced to screen readers. */
function SearchPicker<T>({
  label, placeholder, query, setQuery, results, loading, render, getKey, onPick, isPicked, empty,
}: {
  label: string;
  placeholder: string;
  query: string;
  setQuery: (q: string) => void;
  results: T[] | undefined;
  loading: boolean;
  render: (item: T) => { title: string; subtitle: string; badge?: string };
  getKey: (item: T) => string;
  onPick: (item: T) => void;
  isPicked?: (item: T) => boolean;
  empty: string;
}) {
  const listId = useId();
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          aria-controls={listId}
          className="pl-9"
        />
      </div>
      <ul id={listId} aria-live="polite" className="max-h-56 divide-y overflow-y-auto rounded-lg border bg-card">
        {loading && !results?.length ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">Searching…</li>
        ) : !results?.length ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">{empty}</li>
        ) : (
          results.map((item) => {
            const r = render(item);
            const picked = isPicked?.(item) ?? false;
            return (
              <li key={getKey(item)}>
                <button
                  type="button"
                  disabled={picked}
                  onClick={() => onPick(item)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm outline-none enabled:hover:bg-muted/60 focus-visible:bg-muted disabled:opacity-60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(r.title)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                  </span>
                  {r.badge && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{r.badge}</span>}
                  {picked ? <Check className="size-4 text-success" aria-label="Added" /> : <span className="text-xs font-semibold text-primary">Add</span>}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

export function StudentPicker({ onPick, pickedIds = [], withoutLogin = false }: {
  onPick: (s: StudentOption) => void; pickedIds?: string[]; withoutLogin?: boolean;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const options = useStudentOptions(query, withoutLogin);
  return (
    <SearchPicker
      label="Search students"
      placeholder="Search by name or admission number"
      query={q}
      setQuery={setQ}
      results={options.data}
      loading={options.isFetching}
      getKey={(s) => s.id}
      render={(s) => ({ title: s.name, subtitle: `${s.admission_no} · ${s.class_section}`, badge: s.has_login ? "Has login" : undefined })}
      onPick={onPick}
      isPicked={(s) => pickedIds.includes(s.id)}
      empty={withoutLogin ? "No students without a login match. Add the student first under Students." : "No students match."}
    />
  );
}

export function ParentPicker({ onPick, pickedIds = [] }: { onPick: (u: User) => void; pickedIds?: string[] }) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const parents = useUsers({ page: 1, page_size: 10, role: "parent", search: query || undefined, is_active: true });
  return (
    <SearchPicker
      label="Search parents"
      placeholder="Search parents by name, email or phone"
      query={q}
      setQuery={setQ}
      results={parents.data?.data}
      loading={parents.isFetching}
      getKey={(u) => u.id}
      render={(u) => ({ title: u.full_name, subtitle: [u.phone, u.email].filter(Boolean).join(" · ") })}
      onPick={onPick}
      isPicked={(u) => pickedIds.includes(u.id)}
      empty="No parent accounts match. Add a new parent instead."
    />
  );
}

export function Chip({ children, onRemove, label }: { children: React.ReactNode; onRemove?: () => void; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-primary/[0.06] py-1 pr-1 pl-3 text-sm", !onRemove && "pr-3")}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-full p-1 outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}
