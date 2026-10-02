import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:convert';
import 'package:flutter/services.dart';
import '../providers/attendance_provider.dart';

class QrScannerScreen extends ConsumerStatefulWidget {
  const QrScannerScreen({super.key});
  @override
  ConsumerState<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends ConsumerState<QrScannerScreen> {
  final _controller = MobileScannerController();
  bool _isProcessing = false;
  String? _lastResult;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QR Attendance'), actions: [
        IconButton(icon: const Icon(Icons.flash_on), onPressed: _controller.toggleTorch),
      ]),
      body: Stack(children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
        ),
        Center(child: Container(
          width: 250, height: 250,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.green, width: 3),
            borderRadius: BorderRadius.circular(16),
          ),
        )),
        if (_lastResult != null) Positioned(
          bottom: 40, left: 16, right: 16,
          child: Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(_lastResult!, style: const TextStyle(fontSize: 16)),
          )),
        ),
      ]),
    );
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode?.rawValue == null) return;

    setState(() => _isProcessing = true);

    try {
      final qrData = barcode!.rawValue!;
      final parsed = jsonDecode(qrData) as Map<String, dynamic>;
      final studentId = parsed['student_id'] as String;

      final result = await ref.read(attendanceNotifierProvider.notifier)
          .processQrScan(studentId, 'gate');

      setState(() => _lastResult = 'marked present');
      HapticFeedback.mediumImpact();
    } catch (e) {
      final msg = e.toString().contains('ALREADY_SCANNED')
          ? 'Already scanned in last 10 minutes'
          : 'Scan failed';
      setState(() => _lastResult = msg);
      HapticFeedback.vibrate();
    } finally {
      await Future.delayed(const Duration(seconds: 2));
      setState(() { _isProcessing = false; _lastResult = null; });
    }
  }

  @override
  void dispose() { _controller.dispose(); super.dispose(); }
}
