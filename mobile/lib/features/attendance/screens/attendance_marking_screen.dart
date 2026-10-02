import 'package:flutter/material.dart';

class AttendanceMarkingScreen extends StatelessWidget {
  const AttendanceMarkingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manual Attendance')),
      body: ListView(
        children: const [
          ListTile(title: Text('John Doe'), subtitle: Text('Roll: 101')),
          ListTile(title: Text('Jane Doe'), subtitle: Text('Roll: 102')),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        label: const Text('Save'),
        icon: const Icon(Icons.save),
      ),
    );
  }
}
