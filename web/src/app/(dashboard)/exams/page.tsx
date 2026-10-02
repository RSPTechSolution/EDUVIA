'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ExamsIndex() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations"
        description="Manage school exams, grading, and analysis."
        actions={<Button><Plus className="mr-2 h-4 w-4" /> New Exam</Button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-2">Mid-Term Exams 2023</h3>
            <p className="text-sm text-muted-foreground mb-4">Completed on Oct 15, 2023</p>
            <Link href="/exams/1/analysis">
              <Button variant="outline" className="w-full">View Analysis</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
