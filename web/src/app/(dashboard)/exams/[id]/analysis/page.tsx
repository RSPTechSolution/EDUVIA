'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useParams } from 'next/navigation';

export default function ItemAnalysisPage() {
  const params = useParams();
  const examId = params.id || 'default-exam-id';

  const { data: response } = useQuery({
    queryKey: ['exam_analysis', examId],
    queryFn: async () => {
      const res = await apiClient.get(`/exams/${examId}/analysis`);
      return res.data;
    }
  });

  const questions = response || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Item Analysis Dashboard" 
        breadcrumbs={[{ label: 'Exams', href: '/exams' }, { label: 'Analysis' }]} 
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Question Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground mb-4">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-success rounded-sm" /> Correct</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-destructive rounded-sm" /> Wrong</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-muted-foreground/20 rounded-sm" /> Skipped</div>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-3 group">
                <span className="text-xs text-muted-foreground w-6 text-right tabular-nums">Q{i+1}</span>
                <div className="flex-1 flex h-5 overflow-hidden rounded-full bg-muted border border-border group-hover:border-primary/30 transition-colors">
                  <div className="bg-success h-full transition-all" style={{ width: `${q.correct_pct}%` }} title={`${q.correct_pct}% correct`} />
                  <div className="bg-destructive h-full transition-all" style={{ width: `${q.wrong_pct}%` }} title={`${q.wrong_pct}% wrong`} />
                  <div className="bg-muted-foreground/20 h-full transition-all" style={{ width: `${q.skip_pct}%` }} title={`${q.skip_pct}% skipped`} />
                </div>
                <span className="text-xs font-semibold text-success w-10 text-right tabular-nums">{q.correct_pct}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
