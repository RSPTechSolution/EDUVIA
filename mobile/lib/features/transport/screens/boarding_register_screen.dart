import 'package:flutter/material.dart';

class BoardingRegisterScreen extends StatefulWidget {
  final String tripId;
  const BoardingRegisterScreen({super.key, required this.tripId});
  @override
  State<BoardingRegisterScreen> createState() => _BoardingRegisterScreenState();
}

class _BoardingRegisterScreenState extends State<BoardingRegisterScreen> {
  final _students = [
    {'id': 's1', 'name': 'Alice Smith', 'stop': 'Stop A', 'status': 'pending'},
    {'id': 's2', 'name': 'Bob Jones', 'stop': 'Stop A', 'status': 'pending'},
    {'id': 's3', 'name': 'Charlie Brown', 'stop': 'Stop B', 'status': 'pending'},
  ];

  void _markStatus(int index, String status) {
    setState(() {
      _students[index]['status'] = status;
    });
  }

  void _completeTrip() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Trip Completed & Synced!')));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Boarding Register')),
      body: ListView.builder(
        itemCount: _students.length,
        itemBuilder: (ctx, i) {
          final student = _students[i];
          return ListTile(
            title: Text(student['name']!),
            subtitle: Text(student['stop']!),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.check_circle, 
                    color: student['status'] == 'boarded' ? Colors.green : Colors.grey),
                  onPressed: () => _markStatus(i, 'boarded'),
                ),
                IconButton(
                  icon: Icon(Icons.cancel, 
                    color: student['status'] == 'absent' ? Colors.red : Colors.grey),
                  onPressed: () => _markStatus(i, 'absent'),
                ),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _completeTrip,
        label: const Text('Complete Trip'),
        icon: const Icon(Icons.flag),
      ),
    );
  }
}
