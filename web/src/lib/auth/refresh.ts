import type { ApiEnvelope, TokenPair } from "@/lib/api/types";

export const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** Shared by middleware and route handlers. Concurrent refreshes with the same
 *  token share one request, because the API rotates refresh tokens on use and
 *  would treat a second use as token theft. */
const inflight = new Map<string, Promise<TokenPair | null>>();

export function refreshTokens(refreshToken: string, forwardedFor?: string | null): Promise<TokenPair | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}) },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      return ((await res.json()) as ApiEnvelope<TokenPair>).data;
    } catch {
      return null;
    }
  })();
  inflight.set(refreshToken, p);
  // Keep the result briefly so requests that arrive just after still share it.
  p.finally(() => setTimeout(() => inflight.delete(refreshToken), 10_000));
  return p;
}
