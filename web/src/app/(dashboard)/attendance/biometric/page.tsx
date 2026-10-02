'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Fingerprint, Wifi, ShieldAlert, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function BiometricDashboardPage() {
  const { data: response } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await apiClient.get('/attendance/devices');
      return res.data;
    }
  });
  
  const devices = response || [];
  const [punches, setPunches] = useState<any[]>([]);

  useEffect(() => {
    const names = ['John Doe', 'Jane Smith', 'Alex Wong', 'Sara Lee'];
    const interval = setInterval(() => {
      setPunches(p => [{
        id: Date.now(),
        name: names[Math.floor(Math.random() * names.length)],
        time: new Date().toLocaleTimeString(),
        device: 'Main Gate ZK',
        type: Math.random() > 0.5 ? 'IN' : 'OUT'
      }, ...p].slice(0, 10));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biometric Devices"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance', href: '/attendance' }, { label: 'Devices' }]}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold">Connected Devices</h3>
          {devices.map(d => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${d.status === 'online' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {d.status === 'online' ? <Wifi className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.ip} • Last sync: {d.lastSync}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Live Punch Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {punches.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-2 rounded bg-muted/50 text-sm animate-in slide-in-from-top-2">
                    <div>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">via {p.device}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.type === 'IN' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>{p.type}</span>
                      <span className="text-xs font-mono text-muted-foreground">{p.time}</span>
                    </div>
                  </div>
                ))}
                {punches.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Waiting for punches...</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
