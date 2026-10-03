import "server-only";
import { API_URL } from "@/lib/auth/refresh";
import type { ApiEnvelope, Plan, PricingCatalog } from "./types";

/** Public, cacheable data for the marketing pages. */
async function getPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/public${path}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Public API ${path} failed: ${res.status}`);
  return ((await res.json()) as ApiEnvelope<T>).data;
}

export const getPlans = () => getPublic<Plan[]>("/plans");
export const getPricing = () => getPublic<PricingCatalog>("/pricing");
