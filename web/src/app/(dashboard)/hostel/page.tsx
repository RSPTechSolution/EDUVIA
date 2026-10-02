'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function HostelRoomsPage() {
  const { data: response } = useQuery({
    queryKey: ['hostel_rooms'],
    queryFn: async () => {
      const res = await apiClient.get('/schools/hostel/rooms');
      return res.data;
    }
  });

  const rooms = response || [];
  const [activeBlock, setActiveBlock] = useState('A');

  return (
    <div className="space-y-6">
      <PageHeader title="Hostel Management" breadcrumbs={[{ label: 'Operations' }, { label: 'Hostel' }]} />
      
      <div className="flex gap-2 border-b border-border pb-2">
        {['Block A', 'Block B', 'Girls Hostel'].map(b => (
          <button key={b} onClick={() => setActiveBlock(b[6] || b)} className={`px-4 py-2 text-sm font-semibold rounded-t-lg ${activeBlock === (b[6] || b) ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}>
            {b}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">First Floor</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {rooms.map((room: any) => (
            <div key={room.id} className={cn(
              'rounded-xl border-2 p-4 cursor-pointer transition-all',
              'hover:border-primary/40 hover:shadow-hover',
              room.occupancy >= room.capacity ? 'border-destructive/30 bg-destructive/5' : room.occupancy > 0 ? 'border-success/30 bg-success/5' : 'border-border bg-card',
            )}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-foreground text-lg">{room.room_number}</p>
                  <Badge variant="outline" className="text-[10px] mt-1 bg-background">{room.room_type}</Badge>
                </div>
                <span className={cn('text-xs font-bold tabular-nums', room.occupancy >= room.capacity ? 'text-destructive' : 'text-muted-foreground')}>
                  {room.occupancy}/{room.capacity}
                </span>
              </div>
              <Progress 
                value={(room.occupancy / room.capacity) * 100} 
                className={cn('h-2', room.occupancy >= room.capacity ? '[&>div]:bg-destructive' : '[&>div]:bg-success')} 
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
