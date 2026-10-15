import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Show a change straight away, before the server answers: patches the matching rows in every cached list under `key`
 * (plain arrays and paged `{ data: [...] }` results). Returns an undo that puts every list back as it was, for when
 * the server says no. Use with `onMutate` and call the undo from `onError`; refetch in `onSettled` as usual.
 */
export async function patchLists<T>(qc: QueryClient, key: QueryKey, match: (row: T) => boolean, patch: Partial<T>) {
  await qc.cancelQueries({ queryKey: key }); // a refetch landing now would overwrite the change
  const before = qc.getQueriesData({ queryKey: key });
  const apply = (rows: T[]) => rows.map((r) => (match(r) ? { ...r, ...patch } : r));
  qc.setQueriesData({ queryKey: key }, (old: unknown) => {
    if (Array.isArray(old)) return apply(old as T[]);
    if (old && typeof old === "object" && Array.isArray((old as { data?: unknown }).data)) {
      return { ...(old as object), data: apply((old as { data: T[] }).data) };
    }
    return old;
  });
  return () => before.forEach(([k, data]) => qc.setQueryData(k, data));
}
