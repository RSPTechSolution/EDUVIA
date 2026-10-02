'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState } from 'react';

const mockMessagesFallback = [
  { id: 1, body: 'Hello, can I check my attendance for this month?', sent_at: new Date().toISOString(), isOwn: false, sender: { name: 'Student A', initials: 'SA' } },
  { id: 2, body: 'Sure, you have 92% attendance.', sent_at: new Date().toISOString(), isOwn: true, read_by: [1] },
];

export default function ChatUIPage() {
  const [inputText, setInputText] = useState('');
  
  const { data: response, refetch } = useQuery({
    queryKey: ['chat_messages'],
    queryFn: async () => {
      const res = await apiClient.get('/schools/communication/chat');
      // Map API to expected format
      return res.data.map((m: any) => ({
        id: m.id,
        body: m.text,
        sent_at: new Date().toISOString(), // Mock time
        isOwn: m.sender === 'me',
        sender: { name: 'Student A', initials: 'SA' }
      }));
    }
  });

  const messages = response || mockMessagesFallback;

  const handleSend = async () => {
    if (!inputText) return;
    try {
      await apiClient.post('/schools/communication/chat', { text: inputText, recipient_id: 'user_123' });
      setInputText('');
      refetch();
    } catch (e) {
      console.error(e);
    }
  };
  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <PageHeader title="Messages" breadcrumbs={[{ label: 'Communication' }, { label: 'Chat' }]} />
      
      <div className="flex-1 flex border border-border rounded-xl bg-card overflow-hidden">
        {/* Thread list */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search chats..." className="pl-8 bg-muted/50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-border bg-muted/30 cursor-pointer flex gap-3 items-center">
              <Avatar><AvatarFallback>SA</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline"><h4 className="font-semibold text-sm">Student A</h4><span className="text-[10px] text-muted-foreground">12:30 PM</span></div>
                <p className="text-xs text-muted-foreground truncate">Hello, can I check my...</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat view */}
        <div className="flex-1 flex flex-col bg-muted/10">
          <div className="p-4 border-b border-border bg-card flex items-center gap-3 shadow-sm z-10">
            <Avatar><AvatarFallback>SA</AvatarFallback></Avatar>
            <h4 className="font-semibold">Student A</h4>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg: any) => (
              <div key={msg.id} className={cn('flex gap-2.5 max-w-[75%]', msg.isOwn ? 'ml-auto flex-row-reverse' : '')}>
                {!msg.isOwn && <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{msg.sender.initials}</AvatarFallback></Avatar>}
                <div className={cn('rounded-2xl px-3.5 py-2.5', msg.isOwn ? 'rounded-br-sm bg-primary text-white' : 'rounded-bl-sm bg-card border border-border')}>
                  {!msg.isOwn && <p className="text-[10px] font-semibold text-primary mb-1">{msg.sender?.name}</p>}
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                  <p className={cn('mt-1 text-[10px]', msg.isOwn ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
                    {format(new Date(msg.sent_at), 'h:mm a')}
                    {msg.isOwn && <span className="ml-1">✓✓</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 bg-card border-t border-border flex items-center gap-2">
            <Input 
              placeholder="Type a message..." 
              className="flex-1 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            />
            <Button size="icon" className="shrink-0 rounded-full h-10 w-10" onClick={handleSend}><Send className="h-4 w-4 ml-0.5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
