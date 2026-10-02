'use client';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CalendarCheck, Wallet, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const mockAreaData = Array.from({length: 30}).map((_, i) => ({ date: `Day ${i+1}`, value: 70 + Math.random() * 25 }));
const mockBarData = [
  { name: 'Jan', tuition: 4000, transport: 2400 },
  { name: 'Feb', tuition: 3000, transport: 1398 },
  { name: 'Mar', tuition: 2000, transport: 9800 },
];
const mockDonutData = [{ name: 'Male', value: 550 }, { name: 'Female', value: 450 }];
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

export default function AnalyticsDashboardPage() {
  const { data: response } = useQuery({
    queryKey: ['analytics_stats'],
    queryFn: async () => {
      const res = await apiClient.get('/schools/analytics');
      return res.data;
    }
  });

  const areaData = response?.area || mockAreaData;
  const barData = response?.bar || mockBarData;
  const donutData = response?.donut || mockDonutData;
  const stats = response?.stats || { total_students: 1000, attendance_rate: 92, fee_collection: 450000, pass_rate: 88 };
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics Dashboard" description="School performance insights and reporting" />
      
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Students" value={stats.total_students} icon={Users} />
        <StatCard title="Attendance Rate" value={stats.attendance_rate} suffix="%" icon={CalendarCheck} iconColor="text-success" />
        <StatCard title="Fee Collection" value={stats.fee_collection} prefix="₹" icon={Wallet} iconColor="text-primary" />
        <StatCard title="Pass Rate" value={stats.pass_rate} suffix="%" icon={Activity} iconColor="text-info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Attendance Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Fee Collection (12m)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip />
                <Bar dataKey="tuition" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="transport" stackId="a" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Student Distribution by Class</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{fontSize: 12}} />
                <YAxis dataKey="name" type="category" tick={{fontSize: 12}} />
                <Tooltip />
                <Bar dataKey="tuition" fill="hsl(var(--chart-3))" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Gender Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donutData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
