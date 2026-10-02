import 'package:flutter/material.dart';

class FeeInvoicesScreen extends StatelessWidget {
  const FeeInvoicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Fee Invoices')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildInvoiceCard(context, 'INV-2024-001', 5000, 5000, 'paid'),
          _buildInvoiceCard(context, 'INV-2024-002', 5000, 2000, 'partial'),
          _buildInvoiceCard(context, 'INV-2024-003', 5000, 0, 'unpaid'),
        ],
      ),
    );
  }

  Widget _buildInvoiceCard(BuildContext context, String invoiceNo, double total, double paid, String status) {
    Color statusColor;
    if (status == 'paid') statusColor = Colors.green;
    else if (status == 'partial') statusColor = Colors.orange;
    else statusColor = Colors.red;

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: ListTile(
        title: Text(invoiceNo),
        subtitle: Text('Total: ₹$total | Paid: ₹$paid'),
        trailing: Chip(
          label: Text(status.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 12)),
          backgroundColor: statusColor,
        ),
        onTap: () {
          // Open details or payment screen
        },
      ),
    );
  }
}
