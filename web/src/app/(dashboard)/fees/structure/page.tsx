'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Plus, Save } from 'lucide-react';
import { useState } from 'react';

const mockClasses = [{ id: 'c1', name: 'Class 1' }, { id: 'c2', name: 'Class 2' }, { id: 'c3', name: 'Class 3' }];
const mockCategories = [{ id: 'cat1', name: 'Tuition Fee' }, { id: 'cat2', name: 'Transport Fee' }];

export default function FeeStructurePage() {
  const [categories, setCategories] = useState(mockCategories);
  const [structure, setStructure] = useState<Record<string, Record<string, string>>>({
    'cat1': { 'c1': '5000', 'c2': '5000', 'c3': '5500' },
    'cat2': { 'c1': '1500', 'c2': '1500', 'c3': '1500' },
  });

  const updateAmount = (catId: string, clsId: string, amount: string) => {
    setStructure(prev => ({
      ...prev,
      [catId]: { ...(prev[catId] || {}), [clsId]: amount }
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Structure Builder"
        description="Configure fee amounts for different categories across classes."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fees', href: '/fees' }, { label: 'Structure' }]}
        actions={
          <Button onClick={() => alert('Saved!')}>
            <Save className="h-4 w-4 mr-2" /> Save Changes
          </Button>
        }
      />
      
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-48 px-4 py-3 text-left font-semibold">Fee Category</th>
              {mockClasses.map(cls => (
                <th key={cls.id} className="min-w-[140px] px-4 py-3 text-center font-semibold">{cls.name}</th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b transition-colors hover:bg-muted/20">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" aria-label="Drag to reorder" />
                    <Input value={cat.name} onChange={() => {}} className="h-8 border-0 px-0 font-medium focus-visible:ring-0 bg-transparent" />
                  </div>
                </td>
                {mockClasses.map(cls => (
                  <td key={cls.id} className="px-4 py-2.5 text-center">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                      <Input
                        type="number" min="0" className="pl-6 h-8 text-right tabular-nums bg-transparent border-muted hover:border-border"
                        value={structure[cat.id]?.[cls.id] ?? ''}
                        onChange={(e) => updateAmount(cat.id, cls.id, e.target.value)}
                      />
                    </div>
                  </td>
                ))}
                <td className="px-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-border">
          <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Category</Button>
        </div>
      </div>
    </div>
  );
}
