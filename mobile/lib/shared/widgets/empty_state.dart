import 'package:flutter/material.dart';

class EmptyState extends StatelessWidget {
  final String title;
  final String message;
  final IconData icon;
  final VoidCallback? onAction;
  final String? actionLabel;

  const EmptyState({super.key, required this.title, required this.message,
                    required this.icon, this.onAction, this.actionLabel});

  @override
  Widget build(BuildContext context) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(icon, size: 80, color: Colors.grey.shade400),
      const SizedBox(height: 16),
      Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.grey.shade700)),
      const SizedBox(height: 8),
      Text(message, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade500)),
      if (onAction != null && actionLabel != null) ...[
        const SizedBox(height: 24),
        ElevatedButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    ]),
  ));
}
