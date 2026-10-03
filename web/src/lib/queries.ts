"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AttendanceOverview, AuditEntry, ChildResults, Exam, ExamDetail, HomeworkDetail, HomeworkItem, HomeworkTarget, MarksSheet,
  MarksSheetRef, MyHomework, Notice, ReportCard, SectionResults, AvailableTeacher, FeeCategory, FeeSummary, InvoiceDetail, InvoiceRow, MyFees, Receipt, Roster,
  SectionCard, SectionReport, StructureMatrix, StudentAttendance, ClassItem, DashboardSummary, ModuleState, Period, RoleRules, School, Student, StudentDetail, StudentOption, Subject,
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

// ---- attendance ------------------------------------------------------------------------------

export function useAttendanceSections(date: string | undefined, enabled = true) {
  return useQuery({ queryKey: ["attendance", "sections", date], enabled, queryFn: async () => (await api<SectionCard[]>("/attendance/sections", { query: { date } })).data });
}

export function useRoster(sectionId: string, date: string | undefined) {
  return useQuery({
    queryKey: ["attendance", "roster", sectionId, date],
    queryFn: async () => (await api<Roster>(`/attendance/sections/${sectionId}`, { query: { date } })).data,
  });
}

export function useAttendanceOverview(date: string | undefined, enabled = true) {
  return useQuery({ queryKey: ["attendance", "overview", date], enabled, queryFn: async () => (await api<AttendanceOverview>("/attendance/overview", { query: { date } })).data });
}

export function useSectionReport(sectionId: string | null, month: string) {
  return useQuery({
    queryKey: ["attendance", "report", sectionId, month],
    enabled: Boolean(sectionId),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<SectionReport>(`/attendance/sections/${sectionId}/report`, { query: { month } })).data,
  });
}

export function useMyAttendance(month: string, enabled = true) {
  return useQuery({
    queryKey: ["attendance", "my", month],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<StudentAttendance[]>("/attendance/my", { query: { month } })).data,
  });
}

export function useStudentAttendance(studentId: string, month: string, enabled = true) {
  return useQuery({
    queryKey: ["attendance", "student", studentId, month],
    enabled,
    queryFn: async () => (await api<StudentAttendance>(`/attendance/students/${studentId}`, { query: { month } })).data,
  });
}

// ---- fees ------------------------------------------------------------------------------------

export function useFeeSummary(enabled = true) {
  return useQuery({ queryKey: ["fees", "summary"], enabled, queryFn: async () => (await api<FeeSummary>("/fees/summary")).data });
}

export interface InvoiceParams { page: number; status?: string; class_id?: string; term?: string; search?: string; student_id?: string; page_size?: number }

export function useInvoices(params: InvoiceParams, enabled = true) {
  return useQuery({
    queryKey: ["fees", "invoices", params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => api<InvoiceRow[]>("/fees/invoices", { query: { page_size: 25, ...params } }),
  });
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: ["fees", "invoice", id], queryFn: async () => (await api<InvoiceDetail>(`/fees/invoices/${id}`)).data });
}

export function useFeeTerms() {
  return useQuery({ queryKey: ["fees", "terms"], queryFn: async () => (await api<string[]>("/fees/terms")).data });
}

export function useFeeCategories() {
  return useQuery({ queryKey: ["fees", "categories"], queryFn: async () => (await api<FeeCategory[]>("/fees/categories")).data });
}

export function useFeeStructures() {
  return useQuery({ queryKey: ["fees", "structures"], queryFn: async () => (await api<StructureMatrix>("/fees/structures")).data });
}

export function useReceipt(id: string) {
  return useQuery({ queryKey: ["fees", "receipt", id], queryFn: async () => (await api<Receipt>(`/fees/payments/${id}/receipt`)).data });
}

export function useMyFees(enabled = true) {
  return useQuery({ queryKey: ["fees", "my"], enabled, queryFn: async () => (await api<MyFees>("/fees/my")).data });
}

// ---- exams -----------------------------------------------------------------------------------

export function useExams(enabled = true) {
  return useQuery({ queryKey: ["exams", "list"], enabled, queryFn: async () => (await api<Exam[]>("/exams")).data });
}

export function useExam(id: string) {
  return useQuery({ queryKey: ["exams", "detail", id], queryFn: async () => (await api<ExamDetail>(`/exams/${id}`)).data });
}

export function useMarksSheets(examId: string) {
  return useQuery({ queryKey: ["exams", "sheets", examId], queryFn: async () => (await api<MarksSheetRef[]>(`/exams/${examId}/marks-sheets`)).data });
}

export function useMarksSheet(paperId: string, sectionId: string) {
  return useQuery({
    queryKey: ["exams", "sheet", paperId, sectionId],
    queryFn: async () => (await api<MarksSheet>(`/exams/papers/${paperId}/sections/${sectionId}`)).data,
  });
}

export function useSectionResults(examId: string, sectionId: string | null) {
  return useQuery({
    queryKey: ["exams", "results", examId, sectionId],
    enabled: Boolean(sectionId),
    placeholderData: keepPreviousData,
    queryFn: async () => (await api<SectionResults>(`/exams/${examId}/results/${sectionId}`)).data,
  });
}

export function useReportCard(examId: string, studentId: string) {
  return useQuery({ queryKey: ["exams", "report", examId, studentId], queryFn: async () => (await api<ReportCard>(`/exams/${examId}/report/${studentId}`)).data });
}

export function useMyResults(enabled = true) {
  return useQuery({ queryKey: ["exams", "my"], enabled, queryFn: async () => (await api<ChildResults[]>("/exams/my")).data });
}

// ---- notices & homework ----------------------------------------------------------------------

export function useNotices(page: number, unread = false, enabled = true) {
  return useQuery({
    queryKey: ["notices", "list", page, unread],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => api<Notice[]>("/notices", { query: { page, page_size: 20, unread: unread || undefined } }),
  });
}

export function useUnreadNotices(enabled = true) {
  return useQuery({
    queryKey: ["notices", "unread"],
    enabled,
    refetchInterval: 120_000,
    queryFn: async () => (await api<{ count: number }>("/notices/unread-count")).data.count,
  });
}

export function useNoticeSections(enabled = true) {
  return useQuery({ queryKey: ["notices", "sections"], enabled, queryFn: async () => (await api<{ id: string; label: string }[]>("/notices/sections")).data });
}

export function useHomeworkList(page: number, sectionId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["homework", "list", page, sectionId],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => api<HomeworkItem[]>("/homework", { query: { page, page_size: 20, section_id: sectionId } }),
  });
}

export function useHomework(id: string) {
  return useQuery({ queryKey: ["homework", "detail", id], queryFn: async () => (await api<HomeworkDetail>(`/homework/${id}`)).data });
}

export function useHomeworkTargets(enabled = true) {
  return useQuery({ queryKey: ["homework", "targets"], enabled, queryFn: async () => (await api<HomeworkTarget[]>("/homework/targets")).data });
}

export function useMyHomework(enabled = true) {
  return useQuery({ queryKey: ["homework", "my"], enabled, queryFn: async () => (await api<MyHomework[]>("/homework/my")).data });
}
