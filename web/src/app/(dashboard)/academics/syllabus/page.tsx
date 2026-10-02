'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function SyllabusTrackerPage() {
  const { data: response, isLoading } = useQuery({
    queryKey: ['syllabus'],
    queryFn: async () => {
      const res = await apiClient.get('/academics/syllabus');
      return res.data;
    }
  });

  const subjects = response || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Syllabus Tracker"
        breadcrumbs={[{ label: 'Academics', href: '/academics' }, { label: 'Syllabus' }]}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(subject => (
          <Card key={subject.name} className="group hover:shadow-hover transition-shadow cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-bold text-primary">{subject.completionPct}%</span>
                  <svg className="absolute inset-0 h-14 w-14 -rotate-90">
                    <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="none" className="text-border" />
                    <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="none" className="text-primary" strokeDasharray="163" strokeDashoffset={163 - (163 * subject.completionPct) / 100} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{subject.name}</p>
                  <p className="text-sm text-muted-foreground">{subject.teacher_name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${subject.completionPct}%` }}></div>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{subject.completedTopics}/{subject.totalTopics}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
