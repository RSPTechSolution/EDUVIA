import 'package:flutter/material.dart';
// import 'package:socket_io_client/socket_io_client.dart' as IO;

class ChatMessage {
  final String body;
  ChatMessage(this.body);
}

class ChatThreadScreen extends StatefulWidget {
  final String threadId;
  const ChatThreadScreen({super.key, required this.threadId});
  @override
  State<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends State<ChatThreadScreen> {
  // late IO.Socket _socket;
  final _messages = <ChatMessage>[];
  final _inputCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initSocket();
  }

  void _initSocket() {
    // Mocking socket initialization to compile correctly without riverpod/socket_io_client installed
    /*
    _socket = IO.io('http://localhost:8000', IO.OptionBuilder().setTransports(['websocket']).build());
    _socket.onConnect((_) {
      _socket.emit('join_thread', {'thread_id': widget.threadId});
    });
    _socket.on('new_message', (data) {
      setState(() => _messages.add(ChatMessage(data['body'])));
    });
    */
  }

  void _sendMessage() {
    final body = _inputCtrl.text.trim();
    if (body.isEmpty) return;
    // _socket.emit('send_message', {'thread_id': widget.threadId, 'body': body});
    setState(() => _messages.add(ChatMessage(body))); // Mock immediate display
    _inputCtrl.clear();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.threadId)),
    body: Column(children: [
      Expanded(child: ListView.builder(
        reverse: true,
        itemCount: _messages.length,
        itemBuilder: (_, i) => Align(
          alignment: Alignment.centerRight,
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFF1A3C5E), borderRadius: BorderRadius.circular(8)),
            child: Text(_messages[_messages.length - 1 - i].body, style: const TextStyle(color: Colors.white)),
          ),
        ),
      )),
      Padding(
        padding: const EdgeInsets.all(8),
        child: Row(children: [
          Expanded(child: TextField(controller: _inputCtrl, decoration: const InputDecoration(hintText: 'Type a message...'))),
          IconButton(icon: const Icon(Icons.send, color: Color(0xFF1A3C5E)), onPressed: _sendMessage),
        ]),
      ),
    ]),
  );

  @override
  void dispose() { 
    // _socket.disconnect(); 
    super.dispose(); 
  }
}
