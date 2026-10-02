import 'package:flutter/material.dart';

class SurveyScreen extends StatefulWidget {
  final String surveyId;
  const SurveyScreen({super.key, required this.surveyId});
  @override
  State<SurveyScreen> createState() => _SurveyScreenState();
}

class _SurveyScreenState extends State<SurveyScreen> {
  final _answers = <String, dynamic>{};
  
  // Mock questions mapping to 9 supported types from SKILL.md
  final _questions = [
    {'id': 'q1', 'type': 'nps', 'text': 'How likely are you to recommend us?'},
    {'id': 'q2', 'type': 'mcq', 'text': 'What is your favorite subject?', 'options': ['Math', 'Science', 'English']},
    {'id': 'q3', 'type': 'text', 'text': 'Any additional feedback?'},
  ];

  void _submit() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Survey Submitted Successfully!')));
    Navigator.pop(context);
  }

  Widget _buildQuestion(Map<String, dynamic> q) {
    final id = q['id'];
    switch (q['type']) {
      case 'nps':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(q['text'], style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              children: List.generate(11, (i) => ChoiceChip(
                label: Text('$i'),
                selected: _answers[id] == i,
                onSelected: (val) => setState(() => _answers[id] = i),
              )),
            ),
          ],
        );
      case 'mcq':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(q['text'], style: const TextStyle(fontSize: 16)),
            ...(q['options'] as List).map((opt) => RadioListTile(
              title: Text(opt),
              value: opt,
              groupValue: _answers[id],
              onChanged: (val) => setState(() => _answers[id] = val),
            ))
          ],
        );
      case 'text':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(q['text'], style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            TextField(
              maxLines: 3,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              onChanged: (val) => _answers[id] = val,
            )
          ],
        );
      default:
        return Text('Unsupported type: ${q['type']}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('School Survey')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _questions.length + 1,
        separatorBuilder: (_, __) => const Divider(height: 32),
        itemBuilder: (ctx, i) {
          if (i == _questions.length) {
            return ElevatedButton(onPressed: _submit, child: const Text('Submit Survey'));
          }
          return _buildQuestion(_questions[i]);
        },
      ),
    );
  }
}
