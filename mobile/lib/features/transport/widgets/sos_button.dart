import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class SosButton extends StatefulWidget {
  final VoidCallback onSosTriggered;
  const SosButton({super.key, required this.onSosTriggered});
  @override
  State<SosButton> createState() => _SosButtonState();
}

class _SosButtonState extends State<SosButton> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 3));
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        HapticFeedback.heavyImpact();
        widget.onSosTriggered();
        _controller.reset();
      }
    });
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onLongPressStart: (_) => _controller.forward(),
    onLongPressEnd: (_) => _controller.reverse(),
    child: AnimatedBuilder(
      animation: _controller,
      builder: (_, child) => Container(
        width: 120, height: 120,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.red.withOpacity(0.1),
          border: Border.all(color: Colors.red, width: 3),
        ),
        child: Stack(alignment: Alignment.center, children: [
          SizedBox(width: 120, height: 120, child: CircularProgressIndicator(
            value: _controller.value, color: Colors.red, strokeWidth: 6,
          )),
          Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.warning_rounded, color: Colors.red, size: 32),
            Text(_controller.value > 0 ? 'Hold...' : 'SOS',
              style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ]),
        ]),
      ),
    ),
  );

  @override
  void dispose() { 
    _controller.dispose(); 
    super.dispose(); 
  }
}
