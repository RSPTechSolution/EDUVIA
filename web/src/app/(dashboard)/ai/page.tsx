'use client';
import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, User, SendHorizontal, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SUGGESTIONS = [
  { icon: '📊', text: "What's today's attendance rate?" },
  { icon: '💰', text: 'Which students have fees outstanding above ₹5,000?' },
  { icon: '🏆', text: 'Who are the top 5 performers in the last exam?' },
  { icon: '🚌', text: 'How many buses are currently active?' },
  { icon: '📚', text: 'Which books are overdue in the library?' },
  { icon: '👥', text: 'How many students were admitted this month?' },
];

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; }

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    const asstMsg: Message = { id: (Date.now()+1).toString(), role: 'assistant', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    // Mock streaming
    const mockResponse = `Here is the information about "${text}". Based on the current database, everything looks optimal. Let me know if you need specific records.`;
    const chars = mockResponse.split('');
    let current = '';
    
    for (let i = 0; i < chars.length; i++) {
      await new Promise(r => setTimeout(r, 20));
      current += chars[i];
      setMessages(prev => prev.map(m => m.id === asstMsg.id ? { ...m, content: current } : m));
    }
    
    setIsStreaming(false);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex h-[calc(100vh-100px)] flex-col border border-border rounded-xl overflow-hidden bg-card/50">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BrainCircuit className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">AI Assistant</h2>
              <p className="text-muted-foreground mt-1">Ask anything about your school data</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-2xl w-full">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s.text)} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm transition-all hover:border-primary/40 hover:shadow-hover">
                  <span className="text-lg flex-shrink-0" aria-hidden>{s.icon}</span>
                  <span className="text-muted-foreground leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm', msg.role === 'user' ? 'bg-primary text-white' : 'bg-muted border border-border')}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : '🤖'}
                  </div>
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm bg-card border border-border text-foreground shadow-sm')}>
                    {msg.content || (isStreaming && msg.role === 'assistant' && (
                      <div className="flex gap-1 items-center h-5">
                        {[0,1,2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    ))}
                    {msg.content}
                    <p className={cn('mt-1.5 text-[10px]', msg.role === 'user' ? 'text-white/60 text-right' : 'text-muted-foreground')}>
                      {format(msg.timestamp, 'h:mm a')}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 rounded-2xl border-2 border-border bg-background px-4 py-3 transition-colors focus-within:border-primary/50 shadow-sm">
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
              placeholder="Ask about attendance, fees, students, exams..." rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-32"
            />
            <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming} className="h-8 w-8 rounded-xl flex-shrink-0">
              {isStreaming ? <Square className="h-3.5 w-3.5" aria-hidden /> : <SendHorizontal className="h-3.5 w-3.5" aria-hidden />}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI answers are grounded in your school's actual data. Press Enter to send.
          </p>
        </div>
      </div>
    </div>
  );
}
