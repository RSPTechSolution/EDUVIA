'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Calculator, Download } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { StatusBadge } from '@/components/ui/status-badge';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const mockPayrollFallback = [
  { id: 1, name: 'John Admin', days: 30, gross: 150000, deductions: 12000, net: 138000, status: 'finalized' },
  { id: 2, name: 'Alice Teacher', days: 28, gross: 85000, deductions: 5000, net: 80000, status: 'finalized' },
];

export default function PayrollDashboardPage() {
  const { data: response } = useQuery({
    queryKey: ['payroll_details'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/payroll/details');
      return res.data;
    }
  });

  const payroll = response?.length ? response : mockPayrollFallback;

  const [isRunning, setIsRunning] = useState(false);
  const [processed, setProcessed] = useState(0);

  const runPayroll = () => {
    setIsRunning(true);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setProcessed(count);
      if (count >= 142) {
        clearInterval(interval);
        setTimeout(() => setIsRunning(false), 500);
      }
    }, 20);
  };

  const columns: any[] = [
    { accessorKey: 'name', header: 'Staff Name' },
    { accessorKey: 'days', header: 'Paid Days' },
    { accessorKey: 'gross', header: 'Gross Pay', cell: ({ getValue }: any) => `₹${getValue().toLocaleString('en-IN')}` },
    { accessorKey: 'deductions', header: 'Deductions', cell: ({ getValue }: any) => <span className="text-destructive">₹{getValue().toLocaleString('en-IN')}</span> },
    { accessorKey: 'net', header: 'Net Pay', cell: ({ getValue }: any) => <span className="font-semibold text-success">₹{getValue().toLocaleString('en-IN')}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }: any) => <StatusBadge status={getValue()} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Payroll Dashboard" 
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'HR', href: '/hr' }, { label: 'Payroll' }]} 
        actions={<Button onClick={runPayroll}>Run Payroll</Button>}
      />
      
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border">
        <div>
          <h3 className="font-semibold">September 2026 Payroll</h3>
          <p className="text-sm text-muted-foreground">142 staff members to process</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Salary Slips</Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Bank Advice</Button>
        </div>
      </div>

      <DataTable columns={columns} data={payroll} />

      <Dialog open={isRunning} onOpenChange={(v: boolean) => !isRunning && setIsRunning(v)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Running Payroll — September 2026</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Calculator className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium">Calculating salaries...</p>
                <p className="text-xs text-muted-foreground">{processed} of 142 staff processed</p>
              </div>
            </div>
            <Progress value={(processed / 142) * 100} className="h-2" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
