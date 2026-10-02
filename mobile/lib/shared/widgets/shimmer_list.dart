import 'package:flutter/material.dart';

class ShimmerList extends StatelessWidget {
  final int itemCount;
  const ShimmerList({super.key, this.itemCount = 5});

  @override
  Widget build(BuildContext context) => ListView.builder(
    itemCount: itemCount,
    itemBuilder: (_, __) => Card(
      child: ListTile(
        leading: const CircleAvatar(backgroundColor: Colors.grey),
        title: Container(height: 14, color: Colors.grey.shade300),
        subtitle: Container(height: 10, color: Colors.grey.shade200),
      ),
    ),
  );
}
