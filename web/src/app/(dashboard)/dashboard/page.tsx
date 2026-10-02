'use client';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, CalendarCheck, Wallet, AlertCircle, UserPlus, UserX, Receipt, Bell, FileText, DoorOpen } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const mockAttendanceDataFallback = Array.from({length: 30}).map((_, i) => ({
  date: `2026-09-${String(i+1).padStart(2, '0')}T00:00:00.000Z`,
  rate: 70 + (i % 25)
}));

const mockFeeDataFallback = [
  { name: 'Jan', tuition_fee: 4000, transport_fee: 2400, other_fee: 2400 },
  { name: 'Feb', tuition_fee: 3000, transport_fee: 1398, other_fee: 2210 },
  { name: 'Mar', tuition_fee: 2000, transport_fee: 9800, other_fee: 2290 },
];

export default function DashboardPage() {
  const router = useRouter();

  const { data: response } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const res = await apiClient.get('/schools/dashboard');
      return res.data;
    }
  });

  const data = response?.kpis || { total_students: 0, students_trend: 0, attendance_rate: 0, attendance_trend: 0, fees_today: 0, fees_trend: 0, fees_outstanding: 0 };
  const attendanceData = response?.attendance || mockAttendanceDataFallback;
  const feeData = response?.fees || mockFeeDataFallback;

  const QUICK_ACTIONS = [
    { label: 'Add Student',   icon: UserPlus,  href: '/students/new',   color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Mark Absent',   icon: UserX,     href: '/attendance',     color: 'text-red-500 bg-red-500/10' },
    { label: 'Collect Fee',   icon: Receipt,   href: '/fees/collect',   color: 'text-green-500 bg-green-500/10' },
    { label: 'Send Notice',   icon: Bell,      href: '/communication',  color: 'text-purple-500 bg-purple-500/10' },
    { label: 'New Exam',      icon: FileText,  href: '/exams/new',      color: 'text-orange-500 bg-orange-500/10' },
    { label: 'Gate Pass',     icon: DoorOpen,  href: '/security',       color: 'text-gray-500 bg-gray-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your school's performance today." />
      
      {/* Zone 1: KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Students" value={data.total_students} icon={Users} trend={data.students_trend} onClick={() => router.push('/students')} />
        <StatCard title="Today's Attendance" value={data.attendance_rate} suffix="%" icon={CalendarCheck} iconColor={data.attendance_rate >= 85 ? 'text-green-500' : 'text-amber-500'} trend={data.attendance_trend} />
        <StatCard title="Fees Collected Today" value={data.fees_today} prefix="₹" icon={Wallet} iconColor="text-emerald-500" trend={data.fees_trend} />
        <StatCard title="Outstanding Fees" value={data.fees_outstanding} prefix="₹" icon={AlertCircle} iconColor="text-red-500" onClick={() => router.push('/fees?status=unpaid')} />
      </div>

      {/* Zone 2: Charts & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>Daily attendance rate — last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={attendanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(d) => format(new Date(d), 'd MMM')} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#attGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  <ReferenceLine y={75} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: '75% min', position: 'right', fontSize: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Fee Collection</CardTitle>
              <CardDescription>Monthly fee collection breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={feeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="tuition_fee" name="Tuition" fill="hsl(var(--chart-1))" radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="transport_fee" name="Transport" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="other_fee" name="Other" fill="hsl(var(--chart-3))" radius={[3,3,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((action, idx) => (
                  <button key={idx} onClick={() => router.push(action.href)}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors">
                    <div className={`p-3 rounded-full mb-3 ${action.color}`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium text-center">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
