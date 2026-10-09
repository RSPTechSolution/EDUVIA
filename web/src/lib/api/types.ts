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
  photo_file_id?: string | null;
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
  student_logins: number;
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
  photo_file_id?: string | null;
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

// ---- exams -----------------------------------------------------------------------------------

export type ExamStatus = "draft" | "upcoming" | "ongoing" | "marks_entry" | "published";

export interface Exam {
  id: string;
  name: string;
  kind: "unit_test" | "term" | "final";
  academic_year: string;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  status: ExamStatus;
  classes: number;
  papers: number;
  marks_entered: number;
  marks_expected: number;
}

export interface ExamPaper {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  exam_date: string | null;
  max_marks: number;
  pass_marks: number;
  marks_entered: number;
  students: number;
}

export interface ExamDetail extends Exam {
  classes_detail: { class_id: string; class_name: string; papers: ExamPaper[] }[];
}

export interface MarksSheetRef {
  paper_id: string;
  section_id: string;
  section_label: string;
  subject_name: string;
  subject_color: string;
  exam_date: string | null;
  max_marks: number;
  entered: number;
  students: number;
}

export interface MarksSheet {
  paper_id: string;
  section_id: string;
  exam_name: string;
  section_label: string;
  subject_name: string;
  max_marks: number;
  pass_marks: number;
  editable: boolean;
  locked_reason: string | null;
  rows: { student_id: string; name: string; roll_no: number | null; marks: number | null; absent: boolean }[];
}

export interface SubjectResult { subject_name: string; max_marks: number; pass_marks: number; marks: number | null; absent: boolean; grade: string | null; passed: boolean | null }

export interface StudentResult {
  student_id: string;
  name: string;
  roll_no: number | null;
  subjects: SubjectResult[];
  total: number;
  max_total: number;
  percent: number | null;
  grade: string | null;
  passed: boolean;
  rank: number | null;
  remark: string | null;
}

export interface SectionResults {
  exam_id: string;
  exam_name: string;
  section_label: string;
  published: boolean;
  students: StudentResult[];
  subjects: { subject_name: string; average: number | null; highest: number | null; pass_rate: number | null }[];
  average_percent: number | null;
  pass_rate: number | null;
}

export interface ReportCard {
  exam_id: string;
  exam_name: string;
  academic_year: string;
  school_name: string;
  school_address: string | null;
  student_name: string;
  admission_no: string;
  class_section: string;
  roll_no: number | null;
  date_of_birth: string;
  class_teacher: string | null;
  result: StudentResult;
  class_size: number;
  attendance_percent: number | null;
  published: boolean;
  co_scholastic?: { area: string; grade: string }[];
}

export interface ChildResults {
  student_id: string;
  name: string;
  class_section: string;
  exams: { exam_id: string; exam_name: string; kind: string; published_at: string; percent: number | null; grade: string | null; rank: number | null; class_size: number; passed: boolean }[];
  upcoming: ExamPaper[];
}

// ---- notices & homework ----------------------------------------------------------------------

export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: "everyone" | "staff" | "families" | "sections";
  audience_label: string;
  section_ids: string[];
  priority: "normal" | "important" | "urgent";
  pinned: boolean;
  created_at: string;
  author: string | null;
  read: boolean;
  can_edit: boolean;
  reads: number | null;
  recipients: number | null;
}

export interface HomeworkItem {
  attachments?: StoredFile[];
  id: string;
  section_id: string;
  section_label: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  title: string;
  details: string | null;
  assigned_on: string;
  due_date: string;
  teacher: string | null;
  students: number;
  done: number;
  checked: number;
  can_edit: boolean;
}

export type HomeworkState = "pending" | "done" | "checked" | "incomplete";

export interface HomeworkDetail extends HomeworkItem {
  roster: { student_id: string; name: string; roll_no: number | null; status: HomeworkState; note: string | null; remark: string | null }[];
}

export interface MyHomework extends HomeworkItem {
  student_id: string;
  student_name: string;
  status: HomeworkState;
  note: string | null;
  remark: string | null;
  overdue: boolean;
}

export interface HomeworkTarget { section_id: string; section_label: string; subjects: { id: string; name: string; color: string }[] }

export interface StoredFile {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  label: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// ---- syllabus & lesson plans ------------------------------------------------------------------

export interface SyllabusTopic {
  id: string;
  unit: string | null;
  title: string;
  planned_month: string | null;
  sort_order: number;
  done_sections: string[];
  completed_on: Record<string, string>;
}

export interface SyllabusView {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  sections: { id: string; name: string; editable: boolean }[];
  can_edit_topics: boolean;
  topics: SyllabusTopic[];
}

export interface CoverageRow {
  section_id: string;
  section_label: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  total: number;
  done: number;
  percent: number | null;
  behind: number;
  last_topic: string | null;
}

export interface ChildSyllabus {
  student_id: string;
  name: string;
  class_section: string;
  subjects: CoverageRow[];
}

export interface LessonPlan {
  id: string;
  section_id: string;
  section_label: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  topic_id: string | null;
  topic_title: string | null;
  date: string;
  title: string;
  objectives: string | null;
  activities: string | null;
  resources: string | null;
  status: "planned" | "taught";
  teacher: string | null;
  can_edit: boolean;
}

// ---- certificates, admissions, promotion, substitutions ---------------------------------------

export interface Certificate {
  id: string;
  student_id: string;
  student_name: string;
  admission_no: string;
  class_section: string;
  kind: "transfer" | "bonafide" | "character";
  serial_no: string;
  issued_on: string;
  details: Record<string, string>;
  issued_by: string | null;
  cancelled: boolean;
}

export type EnquiryStatus = "new" | "contacted" | "visit" | "applied" | "admitted" | "lost";

export interface Enquiry {
  id: string;
  student_name: string;
  date_of_birth: string | null;
  gender: string | null;
  class_id: string | null;
  class_name: string | null;
  parent_name: string;
  phone: string;
  email: string | null;
  previous_school: string | null;
  source: string;
  status: EnquiryStatus;
  follow_up_on: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  notes: { at: string; by: string; text: string }[];
  student_id: string | null;
  created_at: string;
  overdue: boolean;
}

export interface EnquirySummary {
  by_status: Record<EnquiryStatus, number>;
  due_today: number;
  overdue: number;
  this_month: number;
  admitted_this_month: number;
  conversion: number | null;
}

export type PromotionAction = "promote" | "repeat" | "leave" | "graduate";

export interface PromotionPreview {
  section_id: string;
  section_label: string;
  next_class_id: string | null;
  next_class_name: string | null;
  next_sections: { id: string; name: string; students: number; capacity: number | null }[];
  default_section_id: string | null;
  students: {
    student_id: string; name: string; admission_no: string; roll_no: number | null; exam: string | null;
    percent: number | null; passed: boolean | null; suggested: PromotionAction;
  }[];
}

export interface Substitution {
  id: string;
  date: string;
  period_id: string;
  period_name: string;
  start_time: string;
  end_time: string;
  section_id: string;
  section_label: string;
  subject_name: string;
  subject_color: string;
  absent_teacher_id: string | null;
  absent_teacher: string | null;
  substitute_id: string | null;
  substitute: string | null;
  note: string | null;
}

export interface SubstitutionDay {
  date: string;
  absent_teachers: { id: string; full_name: string; periods: number; covered: number }[];
  periods: Substitution[];
}

// ---- calendar, leave, scan, devices, period-wise ------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  kind: "holiday" | "vacation" | "event" | "exam" | "ptm";
  start_date: string;
  end_date: string;
  description: string | null;
  closed: boolean;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  student_name: string;
  class_section: string;
  from_date: string;
  to_date: string;
  days: number;
  kind: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  can_decide: boolean;
  can_cancel: boolean;
}

export interface ScanResult {
  student_id: string;
  name: string;
  class_section: string;
  photo_file_id: string | null;
  status: string;
  already: boolean;
  time: string;
}

export interface BiometricDevice {
  id: string;
  serial_no: string;
  name: string;
  location: string | null;
  is_enabled: boolean;
  last_seen: string | null;
  punches: number;
  online: boolean;
}

export interface Punch { pin: string; punched_at: string; device: string; matched: string | null }

export interface PeriodCard {
  entry_id: string;
  period_name: string;
  start_time: string;
  end_time: string;
  section_id: string;
  section_label: string;
  subject_name: string;
  subject_color: string;
  marked: boolean;
  absent: number;
  cover: boolean;
}

export interface PeriodRoster {
  entry_id: string;
  date: string;
  label: string;
  marked: boolean;
  students: { student_id: string; name: string; roll_no: number | null; day_status: string | null; absent: boolean }[];
}

export interface BunkRow { student_id: string; name: string; section_label: string; periods: string[] }

// ---- accounts -------------------------------------------------------------------------------------

export interface LedgerHead { id: string; kind: "income" | "expense"; name: string; is_active: boolean; total_this_year: number }

export interface AccountEntry {
  id: string;
  voucher_no: string;
  kind: "income" | "expense";
  head_id: string;
  head_name: string;
  date: string;
  amount: number;
  party: string | null;
  method: string;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  attachments: number;
}

export interface AccountsSummary {
  start: string;
  end: string;
  fee_income: number;
  other_income: number;
  expense: number;
  net: number;
  income_by_head: { name: string; amount: number }[];
  expense_by_head: { name: string; amount: number }[];
  by_month: { month: string; income: number; expense: number }[];
  cash_in_hand: number;
}


// ---- online tests, co-scholastic, live classes ----------------------------------------------------

export type QuestionKind = "single" | "multiple" | "true_false" | "short";

export interface Question {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  kind: QuestionKind;
  text: string;
  options: { id: string; text: string }[];
  answer: string[];
  marks: number;
  explanation: string | null;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
  used_in: number;
  can_edit: boolean;
}

export interface OnlineTest {
  id: string;
  title: string;
  instructions: string | null;
  class_id: string;
  subject_id: string;
  subject_name: string;
  section_ids: string[];
  sections_label: string;
  question_ids: string[];
  questions: number;
  max_marks: number;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  shuffle: boolean;
  show_results: "after_submit" | "after_close" | "never";
  published: boolean;
  status: "draft" | "upcoming" | "open" | "closed";
  attempts: number;
  submitted: number;
  average: number | null;
  can_edit: boolean;
}

export interface MyTest {
  test_id: string;
  title: string;
  subject_name: string;
  student_id: string;
  student_name: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  questions: number;
  max_marks: number;
  state: "upcoming" | "open" | "in_progress" | "submitted" | "missed";
  score: number | null;
  percent: number | null;
  released: boolean;
}

export interface AttemptView {
  test_id: string;
  title: string;
  instructions: string | null;
  subject_name: string;
  deadline: string;
  submitted: boolean;
  questions: { id: string; kind: QuestionKind; text: string; options: { id: string; text: string }[]; marks: number }[];
  answers: Record<string, string[] | string>;
}

export interface AttemptResult {
  test_id: string;
  title: string;
  student_id: string;
  student_name: string;
  submitted_at: string | null;
  score: number | null;
  max_marks: number;
  percent: number | null;
  needs_marking: boolean;
  released: boolean;
  questions: {
    id: string; kind: QuestionKind; text: string; options: { id: string; text: string }[]; marks: number;
    your_answer: string[] | string | null; correct: string[] | null; awarded: number | null; explanation: string | null;
  }[];
}

export interface TestResults {
  test: OnlineTest;
  rows: { attempt_id: string | null; student_id: string; name: string; roll_no: number | null; section_label: string;
          state: "not_started" | "in_progress" | "submitted"; score: number | null; percent: number | null; needs_marking: boolean;
          submitted_at: string | null }[];
  questions: { question_id: string; text: string; kind: QuestionKind; correct_percent: number | null; answered: number }[];
}

export interface CoSheet {
  exam_id: string;
  section_id: string;
  label: string;
  areas: { id: string; name: string; sort_order: number }[];
  rows: { student_id: string; name: string; roll_no: number | null; grades: Record<string, string> }[];
  editable: boolean;
}

export interface LiveClass {
  id: string;
  title: string;
  section_ids: string[];
  sections_label: string;
  subject_name: string | null;
  subject_color: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  meeting_url: string;
  provider: string;
  notes: string | null;
  teacher: string | null;
  cancelled: boolean;
  state: "upcoming" | "live" | "ended" | "cancelled";
  can_edit: boolean;
}


// ---- messaging, chat, PTM, surveys --------------------------------------------------------------

export interface MessagingStatus { sms_provider: string; whatsapp_provider: string; events: Record<string, string>; chosen: Record<string, string[]>; today: Record<string, number> }
export interface MessageLogRow { id: string; channel: string; to: string; body: string; kind: string; status: string; error: string | null; created_at: string }
export interface ChatContact { student_id: string; student_name: string; user_id: string; name: string; role: string }
export interface Conversation {
  id: string; student_id: string; student_name: string; other_id: string; other_name: string; other_role: string;
  last_message: string | null; last_message_at: string | null; unread: number;
}
export interface ChatMessage { id: string; mine: boolean; sender: string | null; body: string; created_at: string; read: boolean }
export interface PtmEvent {
  id: string; title: string; date: string; start_time: string; end_time: string; slot_minutes: number; sections_label: string;
  location: string | null; notes: string | null; booked: number; slots: number; past: boolean;
}
export interface PtmChildSlots {
  student_id: string; student_name: string; teacher_id: string | null; teacher_name: string | null; booking: string | null;
  slots: { time: string; free: boolean; mine: boolean }[];
}
export interface PtmScheduleRow { time: string; student_id: string | null; student_name: string | null; parent: string | null; phone: string | null; note: string | null }
export type SurveyQuestionKind = "choice" | "multi" | "rating" | "text";
export interface SurveyQuestion { id: string; kind: SurveyQuestionKind; text: string; options: string[]; required: boolean }
export interface Survey {
  id: string; title: string; description: string | null; audience: string; audience_label: string; section_ids: string[];
  questions: SurveyQuestion[]; anonymous: boolean; closes_at: string | null; published: boolean; open: boolean; responses: number;
  answered: boolean; can_edit: boolean;
}
export interface SurveyResults {
  survey: Survey; responses: number; audience_size: number;
  questions: { id: string; kind: SurveyQuestionKind; text: string; answers: number; counts: Record<string, number>; average: number | null; texts: { text: string; by: string | null }[] }[];
}
