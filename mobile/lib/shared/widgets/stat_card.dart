import 'package:flutter/material.dart';

class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final String? subtitle;

  const StatCard({super.key, required this.title, required this.value,
                  required this.icon, required this.color, this.subtitle});

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 20)),
          const Spacer(),
        ]),
        const SizedBox(height: 12),
        Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
        Text(title, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey.shade600)),
        if (subtitle != null) Text(subtitle!, style: const TextStyle(color: Colors.green, fontSize: 12)),
      ]),
    ),
  );
}
