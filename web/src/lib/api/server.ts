import "server-only";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { API_URL } from "@/lib/auth/refresh";
import type { ApiEnvelope, Me } from "./types";

/** Call the FastAPI backend from the server with the signed-in user's token. */
export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T> & { status: number }> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({ success: false }))) as ApiEnvelope<T>;
  return { ...body, status: res.status };
}

export async function getSession(): Promise<Me | null> {
  const res = await serverApi<Me>("/auth/me");
  return res.success ? res.data : null;
}
