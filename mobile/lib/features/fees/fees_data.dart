import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';

double _n(Object? v) => (v as num?)?.toDouble() ?? 0;

class FeePayment {
  FeePayment.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        receiptNo = j['receipt_no'] as String,
        amount = _n(j['amount']),
        method = j['method'] as String,
        reference = j['reference'] as String?,
        paidAt = DateTime.parse(j['paid_at'] as String).toLocal(),
        collectedBy = j['collected_by'] as String?;

  final String id;
  final String receiptNo;
  final double amount;
  final String method;
  final String? reference;
  final DateTime paidAt;
  final String? collectedBy;
}

class Invoice {
  Invoice.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        invoiceNo = j['invoice_no'] as String,
        studentId = j['student_id'] as String,
        studentName = j['student_name'] as String,
        admissionNo = j['admission_no'] as String,
        classSection = j['class_section'] as String,
        term = j['term'] as String,
        dueDate = DateTime.parse(j['due_date'] as String),
        total = _n(j['total']),
        discount = _n(j['discount']),
        paid = _n(j['paid']),
        balance = _n(j['balance']),
        status = j['status'] as String,
        overdue = j['overdue'] as bool,
        discountReason = j['discount_reason'] as String?,
        items = [for (final i in (j['items'] as List? ?? const []).cast<Map>()) (i['name'] as String, _n(i['amount']))],
        payments = [for (final p in (j['payments'] as List? ?? const []).cast<Map>()) FeePayment.fromJson(p.cast())];

  final String id;
  final String invoiceNo;
  final String studentId;
  final String studentName;
  final String admissionNo;
  final String classSection;
  final String term;
  final DateTime dueDate;
  final double total;
  final double discount;
  final double paid;
  final double balance;
  final String status;
  final bool overdue;
  final String? discountReason;
  final List<(String, double)> items;
  final List<FeePayment> payments;
  double get net => total - discount;
}

class ChildFees {
  ChildFees.fromJson(Map<String, dynamic> j)
      : studentId = j['student_id'] as String,
        name = j['name'] as String,
        classSection = j['class_section'] as String,
        due = _n(j['due']),
        overdue = _n(j['overdue']),
        invoices = [for (final i in (j['invoices'] as List).cast<Map>()) Invoice.fromJson(i.cast())];

  final String studentId;
  final String name;
  final String classSection;
  final double due;
  final double overdue;
  final List<Invoice> invoices;
}

class MyFees {
  MyFees.fromJson(Map<String, dynamic> j)
      : children = [for (final c in (j['children'] as List).cast<Map>()) ChildFees.fromJson(c.cast())],
        totalDue = _n(j['total_due']),
        onlinePayments = j['online_payments'] as bool,
        testMode = j['test_mode'] as bool;

  final List<ChildFees> children;
  final double totalDue;
  final bool onlinePayments;
  final bool testMode;
}

class FeeSummary {
  FeeSummary.fromJson(Map<String, dynamic> j)
      : collectedToday = _n(j['collected_today']),
        collectedMonth = _n(j['collected_month']),
        collectedYear = _n(j['collected_year']),
        outstanding = _n(j['outstanding']),
        overdue = _n(j['overdue']),
        overdueInvoices = j['overdue_invoices'] as int,
        collectionRate = (j['collection_rate'] as num?)?.toDouble(),
        recent = [for (final p in (j['recent'] as List).cast<Map>()) FeePayment.fromJson(p.cast())];

  final double collectedToday;
  final double collectedMonth;
  final double collectedYear;
  final double outstanding;
  final double overdue;
  final int overdueInvoices;
  final double? collectionRate;
  final List<FeePayment> recent;
}

class Receipt {
  Receipt.fromJson(Map<String, dynamic> j)
      : payment = FeePayment.fromJson((j['payment'] as Map).cast()),
        invoice = Invoice.fromJson((j['invoice'] as Map).cast()),
        schoolName = j['school_name'] as String,
        schoolAddress = j['school_address'] as String?,
        balanceAfter = _n(j['balance_after']);

  final FeePayment payment;
  final Invoice invoice;
  final String schoolName;
  final String? schoolAddress;
  final double balanceAfter;
}

const methodLabels = {
  'cash': ('Cash', Icons.payments_outlined),
  'upi': ('UPI', Icons.qr_code_2_rounded),
  'cheque': ('Cheque', Icons.account_balance_outlined),
  'card': ('Card', Icons.credit_card_rounded),
  'bank_transfer': ('Bank transfer', Icons.account_balance_outlined),
  'online': ('Online', Icons.phone_iphone_rounded),
};

final myFeesProvider = FutureProvider.autoDispose<MyFees>((ref) async {
  final res = await ref.watch(apiClientProvider).get<MyFees>('/fees/my', parse: (d) => MyFees.fromJson((d as Map).cast()));
  return res.data;
});

final feeSummaryProvider = FutureProvider.autoDispose<FeeSummary>((ref) async {
  final res = await ref.watch(apiClientProvider).get<FeeSummary>('/fees/summary', parse: (d) => FeeSummary.fromJson((d as Map).cast()));
  return res.data;
});

/// Staff invoice search: (search text, status filter).
final invoiceSearchProvider = FutureProvider.autoDispose.family<List<Invoice>, (String, String)>((ref, args) async {
  final res = await ref.watch(apiClientProvider).get<List<Invoice>>('/fees/invoices',
      query: {'search': args.$1.isEmpty ? null : args.$1, 'status': args.$2, 'page_size': 50},
      parse: (d) => [for (final x in (d as List).cast<Map>()) Invoice.fromJson(x.cast())]);
  return res.data;
});

final invoiceProvider = FutureProvider.autoDispose.family<Invoice, String>((ref, id) async {
  final res = await ref.watch(apiClientProvider).get<Invoice>('/fees/invoices/$id', parse: (d) => Invoice.fromJson((d as Map).cast()));
  return res.data;
});

final receiptProvider = FutureProvider.autoDispose.family<Receipt, String>((ref, id) async {
  final res = await ref.watch(apiClientProvider).get<Receipt>('/fees/payments/$id/receipt', parse: (d) => Receipt.fromJson((d as Map).cast()));
  return res.data;
});
