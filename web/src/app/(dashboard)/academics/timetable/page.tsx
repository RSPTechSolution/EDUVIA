'use client';
import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { AlertCircle, Plus } from 'lucide-react';

type TimetableCellProps = {
  period: number;
  day: number;
  slot: any;
  onEdit: (p: number, d: number) => void;
  hasClash?: boolean;
};

const TimetableCell = ({ period, day, slot, onEdit, hasClash }: TimetableCellProps) => (
  <button
    onClick={() => onEdit(period, day)}
    className={cn(
      'relative h-20 w-full rounded-lg border-2 p-2 text-left text-xs transition-all',
      'hover:border-primary/50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
      slot ? 'bg-card border-transparent shadow-card' : 'border-dashed border-border bg-muted/30',
      hasClash && 'border-destructive bg-destructive/5',
    )}
  >
    {slot ? (
      <>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: slot.subject_color }} aria-hidden />
        <p className="mt-1 font-semibold text-foreground truncate">{slot.subject_name}</p>
        <p className="text-muted-foreground truncate">{slot.teacher_name}</p>
        {hasClash && <AlertCircle className="absolute right-1 top-1 h-3.5 w-3.5 text-destructive" aria-label="Scheduling conflict" />}
      </>
    ) : (
      <Plus className="h-4 w-4 text-muted-foreground/40 m-auto" aria-hidden />
    )}
  </button>
);

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function TimetableBuilderPage() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8];

  const { data: response, isLoading } = useQuery({
    queryKey: ['timetable'],
    queryFn: async () => {
      const res = await apiClient.get('/academics/timetable');
      return res.data;
    }
  });

  const slots = response || [];

  const getSlot = (p: number, d: number) => {
    return slots.find((s: any) => s.period === p && s.day_of_week === d) || null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable Builder"
        breadcrumbs={[{ label: 'Academics', href: '/academics' }, { label: 'Timetable' }]}
      />
      <div className="overflow-x-auto">
        <div className="min-w-[800px] grid grid-cols-7 gap-2">
          {/* Header row */}
          <div className="h-10"></div>
          {days.map(d => (
            <div key={d} className="font-semibold text-center text-sm text-muted-foreground h-10 flex items-center justify-center">
              {d}
            </div>
          ))}
          {/* Grid */}
          {periods.map(p => (
            <React.Fragment key={p}>
              <div className="font-semibold text-center text-sm text-muted-foreground flex items-center justify-center border-r border-border pr-2">
                Period {p}
              </div>
              {days.map((d, i) => (
                <TimetableCell key={`${p}-${i}`} period={p} day={i+1} slot={getSlot(p, i+1)} onEdit={() => {}} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
