import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class GateTerminalScreen extends StatefulWidget {
  const GateTerminalScreen({super.key});
  @override
  State<GateTerminalScreen> createState() => _GateTerminalScreenState();
}

class _GateTerminalScreenState extends State<GateTerminalScreen> {
  Map<String, dynamic>? _result;
  bool _processing = false;

  void _simulateScan() async {
    if (_processing) return;
    setState(() => _processing = true);
    
    // Simulate API delay
    await Future.delayed(const Duration(milliseconds: 500));
    
    setState(() {
      _result = {
        'isApproved': true,
        'personName': 'John Doe',
        'message': 'Gate Pass Approved - Exit Logged'
      };
      _processing = false;
    });
    
    HapticFeedback.heavyImpact();
    
    // Auto reset
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) setState(() => _result = null);
  }

  void _simulateReject() async {
    if (_processing) return;
    setState(() => _processing = true);
    await Future.delayed(const Duration(milliseconds: 500));
    setState(() {
      _result = {
        'isApproved': false,
        'personName': 'Unknown',
        'message': 'Invalid or Used QR Code'
      };
      _processing = false;
    });
    HapticFeedback.heavyImpact();
    await Future.delayed(const Duration(seconds: 3));
    if (mounted) setState(() => _result = null);
  }

  @override
  Widget build(BuildContext context) {
    Color bgColor = Colors.black;
    if (_result != null) {
      bgColor = _result!['isApproved'] ? Colors.green.shade700 : Colors.red.shade700;
    }

    return Scaffold(
      backgroundColor: bgColor,
      body: _result != null
          ? _buildResultOverlay()
          : Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.qr_code_scanner, size: 100, color: Colors.white),
                  const SizedBox(height: 24),
                  const Text('Scanning...', style: TextStyle(color: Colors.white, fontSize: 24)),
                  const SizedBox(height: 48),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ElevatedButton(onPressed: _simulateScan, child: const Text('Mock Valid Scan')),
                      const SizedBox(width: 16),
                      ElevatedButton(onPressed: _simulateReject, child: const Text('Mock Invalid Scan')),
                    ],
                  )
                ],
              ),
            ),
    );
  }

  Widget _buildResultOverlay() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircleAvatar(radius: 60, child: Icon(Icons.person, size: 60)),
          const SizedBox(height: 16),
          Text(_result!['personName'], style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          Text(_result!['message'], style: const TextStyle(color: Colors.white70, fontSize: 18)),
          const SizedBox(height: 24),
          Icon(_result!['isApproved'] ? Icons.check_circle : Icons.cancel, color: Colors.white, size: 80),
        ],
      ),
    );
  }
}
