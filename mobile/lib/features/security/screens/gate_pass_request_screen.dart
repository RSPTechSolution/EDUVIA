import 'package:flutter/material.dart';

class GatePassRequestScreen extends StatefulWidget {
  const GatePassRequestScreen({super.key});
  @override
  State<GatePassRequestScreen> createState() => _GatePassRequestScreenState();
}

class _GatePassRequestScreenState extends State<GatePassRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  String _status = 'form'; // form, pending, approved
  
  void _submit() {
    if (_formKey.currentState!.validate()) {
      setState(() => _status = 'pending');
      // Simulate admin approval
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) setState(() => _status = 'approved');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Request Gate Pass')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_status == 'pending') {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Awaiting admin approval...', style: TextStyle(fontSize: 18)),
          ],
        ),
      );
    }
    
    if (_status == 'approved') {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 80),
            const SizedBox(height: 16),
            const Text('Gate Pass Approved!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: const Icon(Icons.qr_code, size: 200), // Mock QR
            ),
            const SizedBox(height: 16),
            const Text('Scan this at the terminal to exit', style: TextStyle(color: Colors.grey)),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () => setState(() => _status = 'form'),
              child: const Text('Request Another'),
            )
          ],
        ),
      );
    }

    return Form(
      key: _formKey,
      child: ListView(
        children: [
          const TextField(
            decoration: InputDecoration(labelText: 'Exit Time', suffixIcon: Icon(Icons.access_time)),
            controller: TextEditingController(text: '14:30'),
            readOnly: true,
          ),
          const SizedBox(height: 16),
          TextFormField(
            decoration: const InputDecoration(labelText: 'Reason for Exit', border: OutlineInputBorder()),
            maxLines: 3,
            validator: (v) => v!.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: _submit,
            style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
            child: const Text('Submit Request'),
          )
        ],
      ),
    );
  }
}
