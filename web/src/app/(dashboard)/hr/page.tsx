'use client';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/data-table/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const mockStaffFallback = [
  { id: 1, name: 'John Admin', emp_id: 'EMP-001', designation: 'Principal', department: 'Administration', join_date: '2020-01-15', salary: 150000, status: 'active' },
  { id: 2, name: 'Alice Teacher', emp_id: 'EMP-002', designation: 'Sr. Teacher', department: 'Academics', join_date: '2021-04-10', salary: 85000, status: 'active' },
];

const SalaryCell = ({ value }: { value: number }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <button onClick={() => setRevealed(p => !p)} className="flex items-center gap-1.5 text-sm font-medium tabular-nums group">
      {revealed ? <span>₹{value.toLocaleString('en-IN')}</span> : <span className="text-muted-foreground tracking-widest">••••••</span>}
      {revealed ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />}
    </button>
  );
};

export default function HRStaffPage() {
  const { data: response } = useQuery({
    queryKey: ['hr_staff'],
    queryFn: async () => {
      const res = await apiClient.get('/hr/staff');
      return res.data;
    }
  });

  const staff = response?.length ? response : mockStaffFallback;
  const columns: any[] = [
    { accessorKey: 'name', header: 'Staff Name' },
    { accessorKey: 'emp_id', header: 'Emp ID', cell: ({ getValue }: any) => <code className="text-xs bg-muted px-1 py-0.5 rounded">{getValue()}</code> },
    { accessorKey: 'designation', header: 'Designation' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'salary', header: 'Salary', cell: ({ getValue }: any) => <SalaryCell value={getValue()} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }: any) => <StatusBadge status={getValue()} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="HR & Staff" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'HR' }]} />
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4"><p className="text-muted-foreground text-sm">Total Staff</p><p className="text-2xl font-bold">142</p></div>
        <div className="bg-card border border-border rounded-xl p-4"><p className="text-muted-foreground text-sm">On Leave</p><p className="text-2xl font-bold text-warning">8</p></div>
        <div className="bg-card border border-border rounded-xl p-4"><p className="text-muted-foreground text-sm">Present</p><p className="text-2xl font-bold text-success">134</p></div>
        <div className="bg-card border border-border rounded-xl p-4"><p className="text-muted-foreground text-sm">Payroll Due</p><p className="text-2xl font-bold text-destructive">In 5 Days</p></div>
      </div>

      <DataTable columns={columns} data={staff} searchPlaceholder="Search staff..." />
    </div>
  );
}
