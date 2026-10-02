import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/students_provider.dart';

class StudentsListScreen extends ConsumerWidget {
  const StudentsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(studentsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Students')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: SearchBar(
              onSubmitted: (query) => ref.read(studentsProvider.notifier).search(query),
              leading: const Icon(Icons.search),
              hintText: 'Search students...',
            ),
          ),
          Expanded(
            child: state.when(
              data: (data) => ListView.builder(
                itemCount: data.items.length,
                itemBuilder: (context, index) {
                  final student = data.items[index];
                  return ListTile(
                    title: Text('${student["first_name"]} ${student["last_name"]}'),
                    subtitle: Text('Admn: ${student["admission_no"]}'),
                  );
                },
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Error: $err')),
            ),
          ),
        ],
      ),
    );
  }
}
