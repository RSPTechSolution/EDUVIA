'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useParams } from 'next/navigation';

const mockStudentFallback = {
  id: '1', first_name: 'John', last_name: 'Doe', photo: '', admission_no: 'ADM001', 
  class_name: 'Class 10', section_name: 'A', date_of_birth: '2005-04-12', 
  gender: 'Male', blood_group: 'O+', phone: '1234567890', email: 'john@example.com', 
  admission_date: '2015-06-01', status: 'active'
};

function ProfileField({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export default function StudentProfilePage() {
  const params = useParams();
  const studentId = params.id || '1';

  const { data: response } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const res = await apiClient.get(`/students/${studentId}`);
      return res.data;
    }
  });

  const student = response || mockStudentFallback;

  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Profile"
        breadcrumbs={[{ label: 'Students', href: '/students' }, { label: `${student.first_name} ${student.last_name}` }]}
      />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/3">
          <Card className="sticky top-20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                  <AvatarFallback className="text-2xl font-bold">JD</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-display text-xl font-bold">{student.first_name} {student.last_name}</h2>
                  <p className="text-sm text-muted-foreground">{student.admission_no}</p>
                  <StatusBadge status={student.status} className="mt-2" />
                </div>
              </div>
              <div className="my-4 h-px bg-border" />
              <ProfileField label="Class"    value={`${student.class_name} — ${student.section_name}`} />
              <ProfileField label="DOB"      value={student.date_of_birth} />
              <ProfileField label="Gender"   value={student.gender} />
              <ProfileField label="Blood"    value={student.blood_group} />
              <ProfileField label="Phone"    value={student.phone} />
              <ProfileField label="Email"    value={student.email} />
              <ProfileField label="Joined"   value={student.admission_date} />
            </CardContent>
          </Card>
        </div>
        <div className="w-full lg:w-2/3">
          <div className="flex overflow-x-auto space-x-2 border-b border-border pb-2 mb-4">
            {['overview', 'academics', 'attendance', 'fees', 'parents', 'documents'].map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 capitalize text-sm font-medium rounded-md ${activeTab === t ? 'bg-primary text-white' : 'hover:bg-muted text-muted-foreground'}`}>
                {t}
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold capitalize mb-4">{activeTab}</h3>
              <p className="text-muted-foreground">Content for {activeTab} goes here...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
