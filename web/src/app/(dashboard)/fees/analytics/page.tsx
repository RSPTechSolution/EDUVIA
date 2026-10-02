'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function FinancialAnalyticsPage() {
  const { data: response } = useQuery({
    queryKey: ['finance_analytics'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/analytics');
      return res.data;
    }
  });

  const monthlyData = response?.monthly || [];
  const categoryData = response?.category || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Analytics" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fees', href: '/fees' }, { label: 'Analytics' }]} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collection Trend</CardTitle>
            <CardDescription>Monthly collected vs target (12 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${v/1000}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="collected" name="Collected" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
                <Line dataKey="target" name="Target" stroke="hsl(var(--warning))" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                <Legend />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} dataKey="amount" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
