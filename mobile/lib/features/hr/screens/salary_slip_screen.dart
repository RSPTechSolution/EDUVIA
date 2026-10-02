import 'package:flutter/material.dart';

class SalarySlipScreen extends StatelessWidget {
  const SalarySlipScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Salary Slip - Oct 2026')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF1A3C5E), Colors.blue]),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Column(
              children: [
                Text('NET PAY', style: TextStyle(color: Colors.white70, letterSpacing: 1.2)),
                SizedBox(height: 8),
                Text('₹ 31,442.31', style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _buildSection('Earnings', [
            _buildRow('Basic Salary', '₹ 27,692.31'),
            _buildRow('HRA', '₹ 5,000.00'),
            _buildRow('Transport Allowance', '₹ 2,000.00'),
            _buildRow('Dearness Allowance', '₹ 1,000.00'),
          ], color: Colors.green),
          const SizedBox(height: 16),
          _buildSection('Deductions', [
            _buildRow('PF', '₹ 1,800.00'),
            _buildRow('ESI', '₹ 450.00'),
            _buildRow('TDS', '₹ 2,000.00'),
          ], color: Colors.red),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Downloading PDF...')));
            },
            icon: const Icon(Icons.download),
            label: const Text('Download PDF'),
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.all(16)),
          )
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children, {required Color color}) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            const Divider(height: 24),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black87)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
