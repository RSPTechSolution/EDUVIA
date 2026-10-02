import 'dart:async';
import 'package:flutter/material.dart';

// Mock models to satisfy UI code compilation without riverpod full providers
class MockQuestion {
  final String id;
  final String text;
  MockQuestion(this.id, this.text);
}

class MockAttempt {
  final String title;
  final List<MockQuestion> questions;
  final Map<String, dynamic> answers;
  MockAttempt(this.title, this.questions, this.answers);
}

class ExamAttemptScreen extends StatefulWidget {
  final String examId;
  const ExamAttemptScreen({super.key, required this.examId});
  @override
  State<ExamAttemptScreen> createState() => _ExamAttemptScreenState();
}

class _ExamAttemptScreenState extends State<ExamAttemptScreen> {
  int _currentIndex = 0;
  late Timer _autosaveTimer;
  late Timer _countdownTimer;
  int _secondsLeft = 3600; // 1 hour for mock

  final MockAttempt attempt = MockAttempt(
    'Midterm Mathematics Exam',
    [MockQuestion('q1', 'What is 2+2?'), MockQuestion('q2', 'Solve for x: 2x = 10')],
    {'q1': '4'}
  );

  @override
  void initState() {
    super.initState();
    _autosaveTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      // Mock autosave
    });
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_secondsLeft > 0) {
        setState(() => _secondsLeft--);
      } else {
        _submit();
      }
    });
  }

  void _submit() {
    Navigator.pop(context);
  }

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(attempt.title),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: _secondsLeft < 300 ? Colors.red : Colors.green,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(_formatTime(_secondsLeft),
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Column(children: [
        SizedBox(
          height: 48,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            itemCount: attempt.questions.length,
            itemBuilder: (ctx, i) => GestureDetector(
              onTap: () => setState(() => _currentIndex = i),
              child: Container(
                margin: const EdgeInsets.all(4),
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: attempt.answers.containsKey(attempt.questions[i].id)
                      ? Colors.green
                      : (i == _currentIndex ? const Color(0xFF1A3C5E) : Colors.grey.shade200),
                  shape: BoxShape.circle,
                ),
                child: Center(child: Text('${i + 1}',
                  style: TextStyle(
                    color: attempt.answers.containsKey(attempt.questions[i].id) || i == _currentIndex
                        ? Colors.white : Colors.black,
                    fontSize: 12,
                  ))),
              ),
            ),
          ),
        ),
        Expanded(child: Center(child: Text(attempt.questions[_currentIndex].text, style: const TextStyle(fontSize: 24)))),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            if (_currentIndex > 0)
              OutlinedButton(onPressed: () => setState(() => _currentIndex--), child: const Text('Previous')),
            const Spacer(),
            if (_currentIndex < attempt.questions.length - 1)
              ElevatedButton(onPressed: () => setState(() => _currentIndex++), child: const Text('Next'))
            else
              ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                child: const Text('Submit'),
              ),
          ]),
        ),
      ]),
    );
  }

  @override
  void dispose() { 
    _autosaveTimer.cancel(); 
    _countdownTimer.cancel(); 
    super.dispose(); 
  }
}
