import 'package:flutter/material.dart';

class IssueBookScreen extends StatefulWidget {
  const IssueBookScreen({super.key});
  @override
  State<IssueBookScreen> createState() => _IssueBookScreenState();
}

class _IssueBookScreenState extends State<IssueBookScreen> {
  String? _scannedBarcode;
  
  void _scanBarcode() {
    // Mocking mobile_scanner behavior
    setState(() {
      _scannedBarcode = 'BC-9780134685991-01';
    });
  }
  
  void _issueBook() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Book Issued Successfully!'), backgroundColor: Colors.green));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Issue Book')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_scannedBarcode == null) ...[
              const Icon(Icons.qr_code_scanner, size: 100, color: Colors.grey),
              const SizedBox(height: 16),
              const Text('Scan book barcode to issue', textAlign: TextAlign.center, style: TextStyle(fontSize: 18, color: Colors.grey)),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: _scanBarcode,
                icon: const Icon(Icons.camera_alt),
                label: const Text('Open Scanner'),
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
              ),
            ] else ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      const Icon(Icons.book, size: 60, color: Color(0xFF1A3C5E)),
                      const SizedBox(height: 16),
                      const Text('Effective Java', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                      const Text('Joshua Bloch', style: TextStyle(color: Colors.grey, fontSize: 16)),
                      const SizedBox(height: 16),
                      Text('Barcode: $_scannedBarcode', style: const TextStyle(fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _issueBook,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
                child: const Text('Confirm Issue'),
              ),
              TextButton(
                onPressed: () => setState(() => _scannedBarcode = null),
                child: const Text('Scan Another'),
              )
            ]
          ],
        ),
      ),
    );
  }
}
