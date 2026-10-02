import 'package:flutter/material.dart';

class ExamResultScreen extends StatelessWidget {
  final String examId;
  const ExamResultScreen({super.key, required this.examId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Exam Results')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 80),
            const SizedBox(height: 16),
            Text('Submitted Successfully', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 32),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Text('Your Auto-Graded Score', style: TextStyle(fontSize: 18)),
                    const SizedBox(height: 16),
                    Text('18 / 20', style: Theme.of(context).textTheme.displayMedium?.copyWith(color: Colors.blue)),
                    const SizedBox(height: 16),
                    const Text('Subjective questions are pending manual review.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Return to Dashboard'),
              ),
            )
          ],
        ),
      ),
    );
  }
}
