"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AuditEntry, DashboardSummary, ModuleState, School, Subscription, User } from "@/lib/api/types";

export const qk = {
  school: ["school", "current"] as const,
  modules: ["school", "modules"] as const,
  users: (params: object) => ["users", params] as const,
  audit: (params: object) => ["audit", params] as const,
  schools: (params: object) => ["platform", "schools", params] as const,
  schoolModules: (id: string) => ["platform", "schools", id, "modules"] as const,
};

export function useCurrentSchool() {
  return useQuery({ queryKey: qk.school, queryFn: async () => (await api<School>("/schools/current")).data });
}

export function useModules(enabled = true) {
  return useQuery({ queryKey: qk.modules, enabled, queryFn: async () => (await api<ModuleState[]>("/schools/current/modules")).data });
}

export interface UserListParams {
  page: number;
  page_size?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}

export function useUsers(params: UserListParams, enabled = true) {
  return useQuery({
    queryKey: qk.users(params),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => api<User[]>("/users", { query: { page_size: 20, ...params } }),
  });
}

export type AuditRow = AuditEntry & { user_name: string | null };

export function useAudit(params: { page: number; page_size?: number; action?: string }, enabled = true) {
  return useQuery({
    queryKey: qk.audit(params),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => api<AuditRow[]>("/users/audit-log", { query: { page_size: 25, ...params } }),
  });
}

export function useSchools(params: { page: number; page_size?: number; search?: string; is_active?: boolean }, enabled = true) {
  return useQuery({
    queryKey: qk.schools(params),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => api<School[]>("/schools", { query: { page_size: 20, ...params } }),
  });
}

export function useSubscription(enabled = true) {
  return useQuery({ queryKey: ["subscription"], enabled, queryFn: async () => (await api<Subscription>("/subscription")).data });
}

export function useDashboardSummary(enabled = true) {
  return useQuery({ queryKey: ["dashboard", "summary"], enabled, queryFn: async () => (await api<DashboardSummary>("/dashboard/summary")).data });
}

export function usePricingCatalog() {
  return useQuery({
    queryKey: ["public", "pricing"],
    staleTime: 10 * 60_000,
    queryFn: async () => (await api<import("@/lib/api/types").PricingCatalog>("/public/pricing")).data,
  });
}
