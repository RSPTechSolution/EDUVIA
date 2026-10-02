import 'package:flutter/material.dart';

class HostelRoomGridScreen extends StatelessWidget {
  const HostelRoomGridScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Mock room data
    final rooms = [
      {'room': '101', 'capacity': 2, 'occupants': 2},
      {'room': '102', 'capacity': 2, 'occupants': 1},
      {'room': '103', 'capacity': 4, 'occupants': 4},
      {'room': '104', 'capacity': 4, 'occupants': 0},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Hostel A - 1st Floor')),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.2,
        ),
        itemCount: rooms.length,
        itemBuilder: (ctx, i) {
          final room = rooms[i];
          final isFull = room['occupants'] == room['capacity'];
          
          return Card(
            color: isFull ? Colors.red.shade50 : Colors.green.shade50,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: isFull ? Colors.red : Colors.green),
            ),
            child: InkWell(
              onTap: isFull ? null : () {
                showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: Text('Allocate Room ${room['room']}'),
                    content: const Text('Select a student to allocate to this room.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                      ElevatedButton(onPressed: () => Navigator.pop(context), child: const Text('Allocate')),
                    ],
                  )
                );
              },
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Room ${room['room']}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('${room['occupants']}/${room['capacity']} Occupied',
                    style: TextStyle(color: isFull ? Colors.red : Colors.green, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 12),
                  if (isFull)
                    const Chip(label: Text('FULL', style: TextStyle(color: Colors.white, fontSize: 10)), backgroundColor: Colors.red)
                  else
                    const Chip(label: Text('AVAILABLE', style: TextStyle(color: Colors.white, fontSize: 10)), backgroundColor: Colors.green),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
