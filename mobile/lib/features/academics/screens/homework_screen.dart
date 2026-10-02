import 'package:flutter/material.dart';

class HomeworkScreen extends StatelessWidget {
  const HomeworkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      body: ListView(
        children: const [
          ListTile(title: Text('Math Worksheet'), subtitle: Text('Due: Tomorrow'), trailing: Chip(label: Text('Pending'))),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Show submit dialog
        },
        child: const Icon(Icons.upload_file),
      ),
    );
  }
}
