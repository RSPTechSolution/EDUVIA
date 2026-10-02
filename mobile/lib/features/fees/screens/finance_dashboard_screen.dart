import 'package:flutter/material.dart';

class FinanceDashboardScreen extends StatelessWidget {
  const FinanceDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Finance Dashboard')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Monthly Collection', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            Container(
              height: 250,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Center(
                child: Text('Chart Placeholder (fl_chart)\nJan: 12L | Feb: 14L | Mar: 11L', textAlign: TextAlign.center),
              ),
            ),
            const SizedBox(height: 24),
            Text('Recent Transactions', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            const ListTile(
              leading: Icon(Icons.download, color: Colors.green),
              title: Text('Fee Collected: RCP-X892'),
              subtitle: Text('Today, 10:42 AM'),
              trailing: Text('+ ₹12,000', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
            ),
            const ListTile(
              leading: Icon(Icons.upload, color: Colors.red),
              title: Text('Expense: Stationary'),
              subtitle: Text('Yesterday, 2:15 PM'),
              trailing: Text('- ₹4,500', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
