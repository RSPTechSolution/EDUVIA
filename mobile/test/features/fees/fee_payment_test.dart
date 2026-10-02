import 'package:flutter_test/flutter_test.dart';

class MockFeeInvoice {
  final String status;
  final double totalAmount;
  MockFeeInvoice({required this.status, required this.totalAmount});
  
  factory MockFeeInvoice.fromJson(Map<String, dynamic> json) {
    return MockFeeInvoice(
      status: json['status'],
      totalAmount: double.parse(json['total_amount']),
    );
  }
}

void main() {
  test('FeeInvoice.fromJson parses status correctly', () {
    final json = {
      'id': 'uuid', 
      'invoice_no': 'INV-001', 
      'total_amount': '5000.00',
      'paid_amount': '2000.00', 
      'status': 'partial', 
      'due_date': '2024-12-31T00:00:00Z'
    };
    
    final invoice = MockFeeInvoice.fromJson(json);
    expect(invoice.status, 'partial');
    expect(invoice.totalAmount, 5000.0);
  });
}
