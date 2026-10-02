import 'package:flutter/material.dart';

class StudentProfileScreen extends StatelessWidget {
  const StudentProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Student Profile'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Academics'),
              Tab(text: 'Fees'),
              Tab(text: 'Attendance'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            Center(child: Text('Academics Tab')),
            Center(child: Text('Fees Tab')),
            Center(child: Text('Attendance Tab')),
          ],
        ),
      ),
    );
  }
}
