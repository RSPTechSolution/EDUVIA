import 'package:flutter/material.dart';

class LeaveApplicationScreen extends StatefulWidget {
  const LeaveApplicationScreen({super.key});
  @override
  State<LeaveApplicationScreen> createState() => _LeaveApplicationScreenState();
}

class _LeaveApplicationScreenState extends State<LeaveApplicationScreen> {
  final _formKey = GlobalKey<FormState>();
  String _selectedType = 'Casual Leave';
  final _reasonController = TextEditingController();

  final _leaveBalances = {
    'Casual Leave': 5,
    'Sick Leave': 3,
    'Earned Leave': 10,
  };

  void _submit() {
    if (_formKey.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Leave Application Submitted Successfully'), backgroundColor: Colors.green)
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Apply for Leave')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: _leaveBalances.entries.map((e) => Column(
                      children: [
                        Text('${e.value}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.blue)),
                        Text(e.key.replaceAll(' ', '\n'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
                      ],
                    )).toList(),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              DropdownButtonFormField<String>(
                value: _selectedType,
                decoration: const InputDecoration(labelText: 'Leave Type', border: OutlineInputBorder()),
                items: _leaveBalances.keys.map((k) => DropdownMenuItem(value: k, child: Text(k))).toList(),
                onChanged: (v) => setState(() => _selectedType = v!),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      decoration: const InputDecoration(labelText: 'Start Date', border: OutlineInputBorder(), suffixIcon: Icon(Icons.calendar_today)),
                      readOnly: true,
                      initialValue: '2026-10-01',
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextFormField(
                      decoration: const InputDecoration(labelText: 'End Date', border: OutlineInputBorder(), suffixIcon: Icon(Icons.calendar_today)),
                      readOnly: true,
                      initialValue: '2026-10-03',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _reasonController,
                decoration: const InputDecoration(labelText: 'Reason', border: OutlineInputBorder()),
                maxLines: 4,
                validator: (v) => v!.isEmpty ? 'Reason is required' : null,
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('Submit Application'),
              )
            ],
          ),
        ),
      ),
    );
  }
}
