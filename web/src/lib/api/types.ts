export interface PageMeta {
  total: number;
  page: number;
  page_size: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta | null;
  error?: { code: string; message: string; details?: unknown };
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface PlanBrief {
  code: string;
  name: string;
  is_custom: boolean;
}

export interface SchoolBrief {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  currency: string;
  plan: PlanBrief;
  subscription_status: string;
  trial_ends_at: string | null;
}

export interface Me {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  school_id: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  school: SchoolBrief | null;
  modules: string[];
  permissions: string[];
}

export interface School {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  language: string;
  is_active: boolean;
  plan: PlanBrief;
  subscription_status: string;
  billing_cycle: string;
  trial_ends_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface ModuleState {
  module: string;
  label: string;
  is_enabled: boolean;
  in_plan: boolean;
  upgrade_plan: string | null;
}

export interface User {
  id: string;
  school_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  employee_id: string | null;
  designation: string | null;
  license_no: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  price_monthly: number;
  price_yearly: number;
  max_students: number | null;
  max_staff: number | null;
  storage_gb: number;
  modules: string[];
  features: string[];
  is_public: boolean;
  is_custom: boolean;
  highlight: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface PricingCatalog {
  currency: string;
  gst_rate: number;
  trial_days: number;
  yearly_months_charged: number;
  platform_fee: number;
  modules: { module: string; label: string; monthly: number; core: boolean }[];
  student_tiers: { from: number; to: number; per_student: number }[];
  min_students: number;
  max_students: number;
}

export interface Quote {
  modules: string[];
  students: number;
  max_staff: number;
  storage_gb: number;
  platform_fee: number;
  module_total: number;
  student_total: number;
  monthly: number;
  yearly: number;
}

export type BillingCycle = "monthly" | "yearly";

export interface Subscription {
  plan: Plan;
  status: string;
  billing_cycle: BillingCycle;
  trial_ends_at: string | null;
  trial_days_left: number;
  trial_expired: boolean;
  current_period_end: string | null;
  can_self_change: boolean;
  usage: { students: number; staff: number };
  available_plans: Plan[];
}

export interface Lead {
  id: string;
  kind: "contact" | "quote" | "upgrade";
  status: "new" | "contacted" | "closed";
  name: string;
  email: string;
  phone: string | null;
  school_name: string | null;
  message: string | null;
  students: number | null;
  modules: string[];
  quoted_monthly: number | null;
  plan_code: string | null;
  created_at: string;
}

export interface DashboardSummary {
  plan: PlanBrief;
  subscription_status: string;
  trial_days_left: number;
  active_users: number;
  roles: { role: string; count: number }[];
  signins: { date: string; count: number }[];
  signins_total: number;
  students: { used: number; limit: number | null };
  staff: { used: number; limit: number | null };
  modules_enabled: number;
  modules_in_plan: number;
}

export interface SectionItem {
  id: string;
  class_id: string;
  name: string;
  capacity: number | null;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  student_count: number;
}

export interface ClassItem {
  id: string;
  name: string;
  sort_order: number;
  sections: SectionItem[];
  student_count: number;
}

export interface Guardian {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  relationship: string;
  is_primary: boolean;
}

export interface Student {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "other";
  date_of_birth: string;
  admission_date: string;
  class_id: string;
  section_id: string;
  class_name: string | null;
  section_name: string | null;
  roll_no: number | null;
  blood_group: string | null;
  address: string | null;
  status: "active" | "inactive" | "alumni";
  user_id: string | null;
  guardian_count: number;
  created_at: string;
}

export interface StudentDetail extends Student {
  guardians: Guardian[];
  login_email: string | null;
}

export interface StudentOption {
  id: string;
  name: string;
  admission_no: string;
  class_section: string;
  has_login: boolean;
}

export interface RoleRules {
  roles: Record<string, { required: string[]; optional: string[] }>;
  labels: Record<string, string>;
  relationships: string[];
  linked_roles: string[];
}

export interface UserDetail {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  employee_id: string | null;
  designation: string | null;
  license_no: string | null;
  is_active: boolean;
  children: { student_id: string; name: string; class_section: string; relationship: string }[];
  student_id: string | null;
  student_name: string | null;
}

// ---- timetable -------------------------------------------------------------------------------

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string;
  teacher_count: number;
  periods_per_week: number;
}

export interface Period {
  id: string;
  name: string;
  start_time: string; // "08:00:00"
  end_time: string;
  sort_order: number;
  is_break: boolean;
}

export interface TimetableEntry {
  id: string;
  day: number; // 1 = Monday .. 6 = Saturday
  period_id: string;
  section_id: string;
  section_label: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  teacher_id: string | null;
  teacher_name: string | null;
  room: string | null;
}

export interface TimetableView {
  title: string;
  subtitle: string | null;
  kind: "section" | "teacher";
  owner_id: string;
  periods: Period[];
  entries: TimetableEntry[];
}

export interface TeacherInfo {
  id: string;
  full_name: string;
  designation: string | null;
  employee_id: string | null;
  subject_ids: string[];
  periods_per_week: number;
  unavailable: { day: number; period_id: string }[];
}

export interface AvailableTeacher {
  id: string;
  full_name: string;
  status: "free" | "busy" | "unavailable" | "current";
  busy_with: string | null;
  qualified: boolean;
  periods_per_week: number;
  periods_that_day: number;
}

// ---- attendance ------------------------------------------------------------------------------

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "leave";
export interface AttendanceCounts { present: number; absent: number; late: number; half_day: number; leave: number }

export interface SectionCard {
  section_id: string;
  label: string;
  class_teacher: string | null;
  is_class_teacher: boolean;
  students: number;
  marked: number;
  present: number;
  absent: number;
  marked_by: string | null;
}

export interface RosterEntry {
  student_id: string;
  name: string;
  admission_no: string;
  roll_no: number | null;
  gender: string;
  status: AttendanceStatus | null;
  remark: string | null;
  recent_percent: number | null; // last 30 days
}

export interface Roster {
  section_id: string;
  label: string;
  date: string;
  editable: boolean;
  locked_reason: string | null;
  marked_by: string | null;
  marked_at: string | null;
  students: RosterEntry[];
  counts: AttendanceCounts;
}

export interface StudentAttendance {
  student_id: string;
  name: string;
  class_section: string;
  month: string;
  days: { date: string; status: AttendanceStatus; remark: string | null }[];
  month_counts: AttendanceCounts;
  month_percent: number | null;
  year_counts: AttendanceCounts;
  year_percent: number | null;
}

export interface AttendanceReportRow { student_id: string; name: string; roll_no: number | null; counts: AttendanceCounts; percent: number | null }

export interface SectionReport {
  section_id: string;
  label: string;
  month: string;
  school_days: number;
  rows: AttendanceReportRow[];
  average_percent: number | null;
}

export interface AttendanceOverview {
  date: string;
  sections_total: number;
  sections_marked: number;
  students_total: number;
  counts: AttendanceCounts;
  percent: number | null;
  sections: SectionCard[];
  trend: { date: string; percent: number | null; marked: number }[];
  low_attendance: AttendanceReportRow[];
}

// ---- fees ------------------------------------------------------------------------------------

export interface FeeCategory { id: string; name: string; description: string | null; is_active: boolean }

export interface StructureMatrix {
  categories: FeeCategory[];
  classes: { class_id: string; class_name: string; students: number; amounts: Record<string, number>; total: number }[];
}

export interface InvoiceRow {
  id: string;
  invoice_no: string;
  student_id: string;
  student_name: string;
  admission_no: string;
  class_section: string;
  term: string;
  due_date: string;
  total: number;
  discount: number;
  paid: number;
  balance: number;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  overdue: boolean;
}

export interface FeePayment {
  id: string;
  receipt_no: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string;
  collected_by: string | null;
}

export interface InvoiceDetail extends InvoiceRow {
  academic_year: string;
  issue_date: string;
  discount_reason: string | null;
  items: { name: string; amount: number }[];
  payments: FeePayment[];
  guardian_phone: string | null;
}

export interface FeeSummary {
  collected_today: number;
  collected_month: number;
  collected_year: number;
  billed_year: number;
  outstanding: number;
  overdue: number;
  overdue_invoices: number;
  collection_rate: number | null;
  daily: { date: string; amount: number }[];
  by_method: { method: string; amount: number; count: number }[];
  by_class: { class_name: string; outstanding: number; students: number }[];
  recent: FeePayment[];
}

export interface Receipt {
  payment: FeePayment;
  invoice: InvoiceDetail;
  school_name: string;
  school_address: string | null;
  school_phone: string | null;
  balance_after: number;
}

export interface MyFees {
  children: { student_id: string; name: string; class_section: string; due: number; overdue: number; next_due_date: string | null; invoices: InvoiceDetail[] }[];
  total_due: number;
  online_payments: boolean;
  test_mode: boolean;
}

export interface PaymentOrder { order_id: string; amount: number; gateway: string; test_mode: boolean; invoice_no: string; description: string }
