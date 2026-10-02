'use client';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function FeeDefaultersPage() {
  const { data: response } = useQuery({
    queryKey: ['finance_defaulters'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/defaulters');
      // Map API fields to match table accessors
      return res.data.map((d: any) => ({
        ...d,
        outstanding: d.amount,
        days_overdue: d.overdue_days
      }));
    }
  });

  const defaulters = response || [];
  const [reminderOpen, setReminderOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(0);

  const handleSend = () => {
    setIsSending(true);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setSent(count);
      if (count >= 2) {
        clearInterval(interval);
        setTimeout(() => { setIsSending(false); setReminderOpen(false); }, 1000);
      }
    }, 1000);
  };

  const columns: any[] = [
    { accessorKey: 'student', header: 'Student', cell: ({ row }: any) => (
      <div>
        <p className="font-medium">{row.original.student}</p>
        <p className="text-xs text-muted-foreground">{row.original.parent_phone}</p>
      </div>
    )},
    { accessorKey: 'class_name', header: 'Class' },
    { accessorKey: 'outstanding', header: 'Outstanding', cell: ({ getValue }: any) => <span className="text-destructive font-semibold tabular-nums">₹{getValue().toLocaleString('en-IN')}</span> },
    { accessorKey: 'days_overdue', header: 'Overdue', cell: ({ getValue }: any) => <span className="text-warning font-medium">{getValue()} days</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Fee Defaulters" 
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fees', href: '/fees' }, { label: 'Defaulters' }]} 
        actions={<Button onClick={() => setReminderOpen(true)}><MessageSquare className="mr-2 h-4 w-4" /> Bulk Reminder</Button>}
      />

      <DataTable columns={columns} data={defaulters} />

      <Dialog open={reminderOpen} onOpenChange={(v: boolean) => !isSending && setReminderOpen(v)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Reminders</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Sending SMS reminders to <strong>2</strong> students about their outstanding fee balances.
          </p>
          
          {isSending ? (
            <div className="space-y-2 mt-4">
              <Progress value={(sent / 2) * 100} />
              <p className="text-xs text-muted-foreground text-center">{sent} / 2 sent</p>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
              <Button onClick={handleSend}><Send className="h-4 w-4 mr-2" /> Send SMS Now</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
