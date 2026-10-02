declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

export const analytics = {
  pageView: (path: string, title: string) => pushDataLayer({ event: 'page_view', page_path: path, page_title: title }),
  login: (method: string, role: string) => pushDataLayer({ event: 'login', method, user_role: role }),
  studentCreated: (classId: string) => pushDataLayer({ event: 'student_created', class_id: classId }),
  studentImported: (count: number) => pushDataLayer({ event: 'student_imported', student_count: count }),
  feeCollected: (amount: number, method: string) => pushDataLayer({ event: 'fee_collected', fee_amount: amount, payment_method: method, currency: 'INR' }),
  attendanceMarked: (sectionId: string, count: number, method: string) => pushDataLayer({ event: 'attendance_marked', section_id: sectionId, student_count: count, marking_method: method }),
  examPublished: (examId: string, mode: string) => pushDataLayer({ event: 'exam_published', exam_id: examId, exam_mode: mode }),
  featureUsed: (featureName: string, context?: string) => pushDataLayer({ event: 'feature_used', feature_name: featureName, context }),
  aiQuery: (intent: string) => pushDataLayer({ event: 'ai_query', intent_name: intent }),
  error: (errorCode: string, errorMessage: string, page: string) => pushDataLayer({ event: 'app_error', error_code: errorCode, error_message: errorMessage, page_path: page }),
};
