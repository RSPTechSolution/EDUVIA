"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AuditEntry, AvailableTeacher, ClassItem, DashboardSummary, ModuleState, Period, RoleRules, School, Student, StudentDetail, StudentOption, Subject,
  Subscription, TeacherInfo, TimetableView, User, UserDetail,
} from "@/lib/api/types";

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

export function useClasses(enabled = true) {
  return useQuery({ queryKey: ["classes"], enabled, queryFn: async () => (await api<ClassItem[]>("/classes")).data });
}

export interface StudentListParams {
  page: number;
  search?: string;
  class_id?: string;
  section_id?: string;
  status?: string;
}

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: ["students", params],
    placeholderData: keepPreviousData,
    queryFn: () => api<Student[]>("/students", { query: { page_size: 25, ...params } }),
  });
}

export function useStudent(id: string) {
  return useQuery({ queryKey: ["student", id], queryFn: async () => (await api<StudentDetail>(`/students/${id}`)).data });
}

export function useStudentOptions(search: string, withoutLogin = false, enabled = true) {
  return useQuery({
    queryKey: ["students", "options", search, withoutLogin],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<StudentOption[]>("/students/options", { query: { search, without_login: withoutLogin } })).data,
  });
}

export function useRoleRules() {
  return useQuery({ queryKey: ["meta", "roles"], staleTime: Infinity, queryFn: async () => (await api<RoleRules>("/meta/roles")).data });
}

export function useUserDetail(id: string | null) {
  return useQuery({ queryKey: ["user", id], enabled: Boolean(id), queryFn: async () => (await api<UserDetail>(`/users/${id}`)).data });
}

// ---- timetable -------------------------------------------------------------------------------

export function useSubjects(enabled = true) {
  return useQuery({ queryKey: ["timetable", "subjects"], enabled, queryFn: async () => (await api<Subject[]>("/timetable/subjects")).data });
}

export function usePeriods() {
  return useQuery({ queryKey: ["timetable", "periods"], queryFn: async () => (await api<Period[]>("/timetable/periods")).data });
}

export function useTimetableTeachers(enabled = true) {
  return useQuery({ queryKey: ["timetable", "teachers"], enabled, queryFn: async () => (await api<TeacherInfo[]>("/timetable/teachers")).data });
}

export function useSectionTimetable(sectionId: string | null) {
  return useQuery({
    queryKey: ["timetable", "section", sectionId],
    enabled: Boolean(sectionId),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<TimetableView>(`/timetable/sections/${sectionId}`)).data,
  });
}

export function useTeacherTimetable(teacherId: string | null) {
  return useQuery({
    queryKey: ["timetable", "teacher", teacherId],
    enabled: Boolean(teacherId),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<TimetableView>(`/timetable/teachers/${teacherId}`)).data,
  });
}

export function useMyTimetables(enabled = true) {
  return useQuery({ queryKey: ["timetable", "my"], enabled, queryFn: async () => (await api<TimetableView[]>("/timetable/my")).data });
}

export function useAvailableTeachers(params: { day: number; period_id: string; subject_id?: string; section_id?: string } | null) {
  return useQuery({
    queryKey: ["timetable", "available", params],
    enabled: Boolean(params),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<AvailableTeacher[]>("/timetable/available-teachers", { query: params! })).data,
  });
}
