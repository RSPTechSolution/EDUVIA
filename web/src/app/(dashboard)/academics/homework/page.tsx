'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function HomeworkBoardPage() {
  const { data: response, isLoading } = useQuery({
    queryKey: ['homework'],
    queryFn: async () => {
      const res = await apiClient.get('/academics/homework');
      return res.data;
    }
  });

  const tasks = response || { todo: [], submitted: [], graded: [] };
  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
      <PageHeader
        title="Homework Board"
        description="Manage and track assignments across classes"
        breadcrumbs={[{ label: 'Academics', href: '/academics' }, { label: 'Homework' }]}
      />
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden pb-4">
        {/* To Do Column */}
        <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">To Do / Active</h3>
            <Badge variant="secondary">{tasks.todo.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-1">
            {tasks.todo.map(task => (
              <Card key={task.id} className="cursor-grab hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="text-xs">{task.subject}</Badge>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{task.class}</span>
                  </div>
                  <p className="font-semibold text-sm leading-tight">{task.title}</p>
                  <div className="flex items-center gap-1.5 text-xs text-warning font-medium">
                    <Clock className="h-3.5 w-3.5" /> Due {task.dueDate}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Submitted Column */}
        <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">Submitted</h3>
            <Badge variant="secondary">{tasks.submitted.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-1">
            {tasks.submitted.map(task => (
              <Card key={task.id} className="cursor-grab hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="text-xs">{task.subject}</Badge>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{task.class}</span>
                  </div>
                  <p className="font-semibold text-sm leading-tight">{task.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-[10px]">S{i}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{task.submittedBy}/{task.total} Submitted</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Graded Column */}
        <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground">Graded</h3>
            <Badge variant="secondary">{tasks.graded.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pr-1">
            {tasks.graded.map(task => (
              <Card key={task.id} className="opacity-75 hover:opacity-100 transition-opacity">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="text-xs">{task.subject}</Badge>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{task.class}</span>
                  </div>
                  <p className="font-semibold text-sm leading-tight line-through text-muted-foreground">{task.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                      Avg Score: {task.avgScore}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
