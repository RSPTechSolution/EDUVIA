import 'package:flutter/material.dart';

class TimetableScreen extends StatelessWidget {
  const TimetableScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Weekly Timetable')),
      body: GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 6),
        itemCount: 36, // 6 days * 6 periods
        itemBuilder: (context, index) {
          return Container(
            margin: const EdgeInsets.all(2),
            color: Colors.blue.withOpacity(0.2),
            child: const Center(child: Text('Subject', style: TextStyle(fontSize: 10))),
          );
        },
      ),
    );
  }
}
