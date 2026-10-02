import type { ApiEnvelope, PageMeta } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field-level messages from a 422 response, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as { field: string; message: string }[]).map((d) => [d.field, d.message.replace(/^Value error, /, "")]),
    );
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

export interface ApiResult<T> {
  data: T;
  meta: PageMeta | null;
}

function buildQuery(query?: Query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Browser-side API call through the same-origin proxy (cookies carry auth). */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<ApiResult<T>> {
  const res = await fetch(`/api/proxy${path}${buildQuery(opts.query)}`, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    credentials: "same-origin",
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !payload?.success) {
    const err = payload?.error;
    if (res.status === 401 && typeof window !== "undefined") {
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/api/auth/logout?next=${encodeURIComponent(next)}`);
    }
    throw new ApiError(err?.message ?? "Request failed", err?.code ?? "HTTP_ERROR", res.status, err?.details);
  }
  return { data: payload.data, meta: payload.meta ?? null };
}

export async function authRequest<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !payload?.success) {
    const err = payload?.error;
    throw new ApiError(err?.message ?? "Request failed", err?.code ?? "HTTP_ERROR", res.status, err?.details);
  }
  return payload.data;
}
