'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, CircleDot, Type, FileText } from 'lucide-react';

export default function SurveyBuilderPage() {
  const tools = [
    { icon: CircleDot, label: 'Multiple Choice' },
    { icon: CheckSquare, label: 'Checkboxes' },
    { icon: Type, label: 'Short Answer' },
    { icon: FileText, label: 'Paragraph' },
  ];

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <PageHeader title="Survey Builder" breadcrumbs={[{ label: 'Communication' }, { label: 'Surveys' }, { label: 'Build' }]} actions={<Button>Save Survey</Button>} />
      
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left: Palette */}
        <div className="w-64 bg-card border border-border rounded-xl p-4 flex flex-col">
          <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Question Types</h3>
          <div className="space-y-2">
            {tools.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:border-primary/50 cursor-grab transition-colors">
                <t.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Right: Canvas */}
        <div className="flex-1 bg-muted/20 border border-border rounded-xl p-8 overflow-y-auto flex justify-center">
          <div className="w-full max-w-2xl space-y-6">
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm border-t-8 border-t-primary">
              <Input className="text-3xl font-display font-bold border-0 bg-transparent px-0 h-auto focus-visible:ring-0 mb-2" defaultValue="Untitled Survey" />
              <Input className="text-sm text-muted-foreground border-0 bg-transparent px-0 h-auto focus-visible:ring-0" defaultValue="Form description" />
            </div>

            <div className="bg-card border-2 border-primary p-6 rounded-xl shadow-sm relative">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-primary/20 rounded cursor-grab flex items-center justify-center">
                <div className="w-1 h-4 border-l-2 border-r-2 border-primary/50" />
              </div>
              <Input className="text-lg font-semibold border-0 border-b border-border bg-muted/50 rounded-none px-2 mb-4 focus-visible:ring-0 focus-visible:border-primary" defaultValue="Question 1" />
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-border" />
                  <Input defaultValue="Option 1" className="h-8 border-0 bg-transparent hover:bg-muted/50" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-border" />
                  <span className="text-sm">Add option</span>
                </div>
              </div>
            </div>
            
            <p className="text-center text-muted-foreground text-sm">Drag items from the left to add more questions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
