import 'package:flutter/material.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});
  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final _messages = <Map<String, String>>[];
  final _inputCtrl = TextEditingController();
  bool _isStreaming = false;

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    setState(() {
      _messages.add({'role': 'user', 'content': text});
      _messages.add({'role': 'assistant', 'content': ''});
      _isStreaming = true;
    });
    _inputCtrl.clear();

    // Mocking streaming SSE
    final mockResponseWords = "I found 42 students with pending fees > 3000.".split(' ');
    for (final word in mockResponseWords) {
      await Future.delayed(const Duration(milliseconds: 200));
      if (!mounted) return;
      setState(() {
        final last = _messages.last;
        _messages[_messages.length - 1] = {'role': 'assistant', 'content': last['content']! + ' ' + word};
      });
    }
    
    if (mounted) {
      setState(() => _isStreaming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Assistant'), actions: const [
        Icon(Icons.auto_awesome, color: Color(0xFF2E7D9E)),
        SizedBox(width: 16),
      ]),
      body: Column(children: [
        if (_messages.isEmpty) Padding(
          padding: const EdgeInsets.all(16),
          child: Wrap(spacing: 8, children: [
            "What's today's attendance?",
            "Students with fee outstanding > ₹5000",
            "Top performers in last exam",
            "Staff on leave today",
          ].map((q) => ActionChip(
            label: Text(q, style: const TextStyle(fontSize: 12)),
            onPressed: () => _sendMessage(q),
          )).toList()),
        ),
        Expanded(child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _messages.length,
          itemBuilder: (_, i) {
            final msg = _messages[i];
            final isUser = msg['role'] == 'user';
            return Align(
              alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                decoration: BoxDecoration(
                  color: isUser ? const Color(0xFF1A3C5E) : Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: msg['content']!.isEmpty && !isUser
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(msg['content']!, style: TextStyle(color: isUser ? Colors.white : Colors.black87)),
              ),
            );
          },
        )),
        Padding(
          padding: EdgeInsets.only(left: 16, right: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16, top: 8),
          child: Row(children: [
            Expanded(child: TextField(
              controller: _inputCtrl,
              decoration: InputDecoration(
                hintText: 'Ask anything about your school...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onSubmitted: _isStreaming ? null : _sendMessage,
            )),
            const SizedBox(width: 8),
            FloatingActionButton(
              mini: true,
              onPressed: _isStreaming ? null : () => _sendMessage(_inputCtrl.text),
              child: const Icon(Icons.send),
            ),
          ]),
        ),
      ]),
    );
  }
}
