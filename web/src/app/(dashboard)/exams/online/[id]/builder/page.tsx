'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, X, Search, Filter } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const mockQuestionBank = [
  { id: '1', type: 'MCQ', difficulty: 'easy', topic: 'Algebra', content: { text: 'What is x if 2x = 4?' }, marks: 1 },
  { id: '2', type: 'Short', difficulty: 'medium', topic: 'Geometry', content: { text: 'Define a triangle.' }, marks: 2 },
  { id: '3', type: 'Long', difficulty: 'hard', topic: 'Calculus', content: { text: 'Find the derivative of x^2.' }, marks: 5 },
];

export default function OnlineExamBuilderPage() {
  const [paper, setPaper] = useState<any[]>(mockQuestionBank);

  const removeQuestion = (id: string) => {
    setPaper(p => p.filter(q => q.id !== id));
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <PageHeader 
        title="Online Exam Builder" 
        breadcrumbs={[{ label: 'Exams', href: '/exams' }, { label: 'Builder' }]} 
        actions={<Button>Publish Exam</Button>}
      />
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        
        {/* Left: Question Bank */}
        <div className="w-full md:w-1/3 flex flex-col bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border space-y-3">
            <h3 className="font-semibold text-lg">Question Bank</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 bg-background" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mockQuestionBank.map((q) => (
              <div key={q.id} className="p-3 border border-border rounded-lg bg-muted/20 hover:bg-muted/50 cursor-pointer">
                <div className="flex gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] uppercase bg-background">{q.type}</Badge>
                  <Badge variant="outline" className={cn('text-[10px] bg-background', q.difficulty === 'easy' ? 'text-success' : q.difficulty === 'hard' ? 'text-destructive' : 'text-warning')}>{q.difficulty}</Badge>
                </div>
                <p className="text-sm line-clamp-2">{q.content.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Paper Canvas */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Paper Canvas</h3>
              <div className="text-sm font-medium">Total: {paper.reduce((acc, q) => acc + q.marks, 0)} Marks</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {paper.map((question, i) => (
              <div key={question.id} className="group relative rounded-lg border-2 border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 mt-0.5 text-muted-foreground cursor-grab flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px] uppercase">{question.type}</Badge>
                      <Badge variant="outline" className={cn('text-[10px]', question.difficulty === 'easy' ? 'border-success/30 text-success' : question.difficulty === 'hard' ? 'border-destructive/30 text-destructive' : 'border-warning/30 text-warning')}>{question.difficulty}</Badge>
                      {question.topic && <span className="text-xs text-muted-foreground">{question.topic}</span>}
                    </div>
                    <p className="text-sm text-foreground">{question.content.text}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Input type="number" defaultValue={question.marks} min={1} className="h-7 w-14 text-center text-xs" />
                      <span className="text-xs text-muted-foreground">marks</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => removeQuestion(question.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {paper.length === 0 && <p className="text-muted-foreground text-center p-8">No questions added yet. Drag from the bank.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
