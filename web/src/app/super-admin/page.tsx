'use client';
import { StatCard } from '@/components/ui/stat-card';
import { Building2, Users, TrendingUp, BarChart3, Plus, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mrrData = [
  { name: 'Jan', mrr: 120000 }, { name: 'Feb', mrr: 150000 }, { name: 'Mar', mrr: 180000 },
  { name: 'Apr', mrr: 210000 }, { name: 'May', mrr: 250000 }, { name: 'Jun', mrr: 310000 },
];

const plans = [
  { id: 'basic', name: 'Basic', price: 5000, interval: 'mo', modules: ['student-management', 'attendance', 'fees'], is_popular: false },
  { id: 'pro', name: 'Pro', price: 12000, interval: 'mo', modules: ['student-management', 'attendance', 'fees', 'exams', 'hr', 'transport'], is_popular: true },
];

export default function SuperAdminDashboard() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('pro');

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Manage all tenant schools and platform metrics</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-2" /> Provision School</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Schools" value={145} icon={Building2} />
        <StatCard title="Total Students" value={84000} icon={Users} />
        <StatCard title="Monthly Revenue" value={1250000} prefix="₹" icon={TrendingUp} iconColor="text-success" />
        <StatCard title="Annual Revenue" value={15000000} prefix="₹" icon={BarChart3} iconColor="text-primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>MRR Trend (12 Months)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tickFormatter={(v) => `₹${v/1000}k`} tick={{fontSize: 12}} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={3} dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Provision New School - Plan Selection</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {plans.map(plan => (
              <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  'relative flex flex-col rounded-xl border-2 p-5 text-left transition-all',
                  selectedPlan === plan.id ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                {plan.is_popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white">Most Popular</span>}
                <p className="font-display text-lg font-bold">{plan.name}</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">₹{plan.price.toLocaleString('en-IN')}</span>
                  <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {plan.modules.slice(0, 5).map(m => (
                    <li key={m} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                      {m.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </li>
                  ))}
                  {plan.modules.length > 5 && <li className="text-xs text-primary">+{plan.modules.length - 5} more modules</li>}
                </ul>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancel</Button>
            <Button onClick={() => setWizardOpen(false)}>Next Step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
