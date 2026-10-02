'use client';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function DailyAttendancePage() {
  const { data: response } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await apiClient.get('/students');
      return res.data;
    }
  });
  const students = response?.items || [];

  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const isDirty = Object.keys(attendance).length > 0;
  
  const handleChange = (id: string, status: string) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  const resetChanges = () => setAttendance({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = Object.entries(attendance).map(([id, status]) => ({ student_id: id, status }));
      const defaultSectionId = '00000000-0000-0000-0000-000000000000'; // dummy section ID for now
      await apiClient.post(`/attendance/${defaultSectionId}`, {
        date: new Date().toISOString().split('T')[0],
        records
      });
    },
    onSuccess: () => {
      toast.success('Attendance saved successfully');
      resetChanges();
    },
    onError: (err: any) => {
      toast.error('Failed to save attendance');
    }
  });

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Daily Attendance"
        description="Mark attendance for classes"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance' }]}
      />
      
      <div className="flex gap-4 p-4 border rounded-xl bg-card">
        {/* Filters would go here */}
        <div className="flex-1">Select Class, Section, Date</div>
        <Button variant="outline" onClick={() => {
          const allPresent = students.reduce((acc: any, s: any) => ({ ...acc, [s.id]: 'present' }), {});
          setAttendance(allPresent);
        }}>Mark All Present</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {students.map((student: any) => {
          const status = attendance[student.id];
          return (
            <div key={student.id} className={cn(
              'rounded-xl border-2 p-3 transition-all duration-150 cursor-pointer select-none',
              status === 'present' ? 'border-success/30 bg-success/5' :
              status === 'absent'  ? 'border-destructive/30 bg-destructive/5' :
              status === 'late'    ? 'border-warning/30 bg-warning/5' :
                                     'border-border bg-card hover:border-primary/30',
            )}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-[10px]">{student.first_name[0]}{student.last_name[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{student.first_name} {student.last_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{student.admission_no}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(['present', 'absent', 'late', 'half_day'] as const).map(s => (
                  <button key={s} onClick={() => handleChange(student.id, s)}
                    className={cn(
                      'rounded-md py-1 text-[10px] font-bold uppercase transition-colors',
                      status === s
                        ? s === 'present' ? 'bg-success text-white' :
                          s === 'absent'  ? 'bg-destructive text-white' :
                          s === 'late'    ? 'bg-warning text-white' :
                                            'bg-info text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20',
                    )}>
                    {s === 'half_day' ? 'H' : s[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-3 shadow-xl">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{Object.keys(attendance).length}</strong> records changed
              </p>
              <Button variant="outline" size="sm" onClick={resetChanges}>Reset</Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" /> Save Attendance
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
