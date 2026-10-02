'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Upload, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function StudentsPage() {
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await apiClient.get('/students');
      return res.data; // ApiResponse.data
    }
  });

  const data = response?.items || [];
  const total = response?.total || 0;

  const columns: any[] = [
    {
      accessorKey: 'photo',
      header: '',
      cell: ({ row }: any) => (
        <Avatar className="h-9 w-9">
          <AvatarImage src={row.original.photo} alt={row.original.first_name} />
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {row.original.first_name[0]}{row.original.last_name[0]}
          </AvatarFallback>
        </Avatar>
      ),
    },
    { accessorKey: 'admission_no', header: 'Adm. No.',
      cell: ({ getValue }: any) => <code className="font-mono text-xs">{getValue()}</code> },
    {
      id: 'name',
      header: 'Student',
      cell: ({ row }: any) => (
        <div>
          <Link href={`/students/${row.original.id}`}
            className="font-medium text-foreground hover:text-primary hover:underline">
            {row.original.first_name} {row.original.last_name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.original.parent_phone}</p>
        </div>
      ),
    },
    { accessorKey: 'class_name',   header: 'Class' },
    { accessorKey: 'section_name', header: 'Section' },
    { accessorKey: 'gender',       header: 'Gender' },
    { accessorKey: 'status',       header: 'Status', cell: ({ getValue }: any) => <StatusBadge status={getValue()} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Manage all student records, admissions and promotions"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students' }]}
        actions={
          <>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="p-4 bg-blue-50 text-blue-900 rounded-lg">Total: {isLoading ? '...' : total}</div>
        <div className="p-4 bg-green-50 text-green-900 rounded-lg">Active: {isLoading ? '...' : total}</div>
        <div className="p-4 bg-gray-50 text-gray-900 rounded-lg">Inactive: 0</div>
        <div className="p-4 bg-purple-50 text-purple-900 rounded-lg">Alumni: 0</div>
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">Loading students...</div>
      ) : isError ? (
        <div className="flex h-32 items-center justify-center text-red-500">Failed to load students. Please check your connection.</div>
      ) : (
        <DataTable columns={columns} data={data} searchPlaceholder="Search students..." />
      )}
    </div>
  );
}
