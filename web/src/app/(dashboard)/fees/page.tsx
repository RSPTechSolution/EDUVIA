'use client';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable } from '@/components/data-table/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, TrendingUp, Calendar, PieChart, Download } from 'lucide-react';
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function FeeCollectionPage() {
  const { data: response } = useQuery({
    queryKey: ['finance_dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/dashboard');
      return res.data;
    }
  });

  const stats = response?.stats || { outstanding: 0, today: 0, month: 0, rate: 0 };
  const invoices = response?.invoices || [];

  const [collectOpen, setCollectOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const columns: any[] = [
    { accessorKey: 'student', header: 'Student' },
    { accessorKey: 'invoice_no', header: 'Invoice No.', cell: ({ getValue }: any) => <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{getValue()}</code> },
    { accessorKey: 'class_name', header: 'Class' },
    { accessorKey: 'total', header: 'Total', cell: ({ getValue }: any) => `₹${getValue().toLocaleString('en-IN')}` },
    { accessorKey: 'balance', header: 'Balance', cell: ({ row }: any) => (
        <span className={`font-semibold tabular-nums ${row.original.balance > 0 ? 'text-destructive' : 'text-success'}`}>
          ₹{row.original.balance.toLocaleString('en-IN')}
        </span>
    )},
    { accessorKey: 'due_date', header: 'Due Date' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }: any) => <StatusBadge status={getValue()} /> },
    { id: 'actions', cell: ({ row }: any) => (
      <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(row.original); setCollectOpen(true); }} disabled={row.original.balance === 0}>
        Collect
      </Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Collection" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fees' }]} />
      
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Outstanding" value={stats.outstanding} prefix="₹" icon={AlertCircle} iconColor="text-destructive" />
        <StatCard title="Collected Today" value={stats.today} prefix="₹" icon={TrendingUp} iconColor="text-success" />
        <StatCard title="This Month" value={stats.month} prefix="₹" icon={Calendar} iconColor="text-primary" />
        <StatCard title="Collection Rate" value={stats.rate} suffix="%" icon={PieChart} iconColor="text-info" />
      </div>

      <DataTable columns={columns} data={invoices} searchPlaceholder="Search invoices or students..." />

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        {selectedInvoice && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Collect Fee</DialogTitle>
              <DialogDescription>{selectedInvoice.student} — Invoice #{selectedInvoice.invoice_no}</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tuition Fee</span>
                <span className="font-medium tabular-nums">₹{selectedInvoice.total.toLocaleString('en-IN')}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Balance Due</span>
                <span className="text-destructive">₹{selectedInvoice.balance.toLocaleString('en-IN')}</span>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="text-sm font-medium mb-1 block">Payment Method</label>
              <div className="flex gap-2 mb-4">
                {['Cash', 'Cheque', 'UPI', 'Online'].map(m => (
                  <button key={m} className={`px-3 py-1.5 rounded-md text-sm border ${m === 'Cash' ? 'bg-primary text-white border-primary' : 'bg-background hover:bg-muted'}`}>
                    {m}
                  </button>
                ))}
              </div>
              <label className="text-sm font-medium mb-1 block">Amount to Collect (₹)</label>
              <Input type="number" defaultValue={selectedInvoice.balance} max={selectedInvoice.balance} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCollectOpen(false)}>Cancel</Button>
              <Button onClick={() => setCollectOpen(false)}>Confirm Collection</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
