'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { MessageSquare, Phone, Mail, BellRing, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

export default function BroadcastPage() {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['sms']);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const channels = [
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'push', label: 'Push Notification', icon: BellRing },
  ];

  const toggleChannel = (id: string) => {
    setSelectedChannels(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);
  };

  const handleSend = async () => {
    if (!message || selectedChannels.length === 0) return;
    setIsSending(true);
    try {
      await apiClient.post('/schools/communication/broadcast', {
        message,
        channels: selectedChannels
      });
      setMessage('');
      alert('Broadcast sent successfully!');
    } catch (e) {
      alert('Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader 
        title="Broadcast Message" 
        breadcrumbs={[{ label: 'Communication', href: '/communication' }, { label: 'Broadcast' }]} 
      />
      
      <div className="space-y-8">
        {/* Step 1 */}
        <section>
          <h3 className="font-semibold text-lg mb-4">1. Select Audience</h3>
          <div className="flex gap-2">
            {['All Students', 'Specific Class', 'Specific Section', 'Individual'].map(a => (
              <Button key={a} variant={a === 'All Students' ? 'default' : 'outline'}>{a}</Button>
            ))}
          </div>
        </section>

        {/* Step 2 */}
        <section>
          <h3 className="font-semibold text-lg mb-4">2. Select Channels</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {channels.map(ch => (
              <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selectedChannels.includes(ch.id) ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                )}>
                <ch.icon className={cn('h-8 w-8', selectedChannels.includes(ch.id) ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">{ch.label}</span>
                {selectedChannels.includes(ch.id) && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </section>

        {/* Step 3 */}
        <section>
          <h3 className="font-semibold text-lg mb-4">3. Compose Message</h3>
          <div className="bg-card border border-border rounded-xl p-4">
            <textarea 
              className="w-full min-h-[150px] bg-transparent outline-none resize-none text-sm"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex items-center justify-between mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>{message.length} / 160 characters (1 SMS credit)</span>
              <Button size="sm" onClick={handleSend} disabled={isSending}>Preview & Send</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
