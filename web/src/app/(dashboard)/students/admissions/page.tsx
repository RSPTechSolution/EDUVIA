'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';

export default function AdmissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions"
        description="Manage new student applications and inquiries."
      />
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-[300px]">
          <h3 className="text-xl font-bold mb-2">No Active Admission Campaigns</h3>
          <p className="text-muted-foreground">Start a new admission drive to see applications here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
