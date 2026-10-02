'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NAV_GROUPS } from '@/config/navigation';
import { useEnabledModules } from '@/hooks/useEnabledModules';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { enabledModules } = useEnabledModules();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-xl overflow-hidden border border-border">
        <input type="text" placeholder="Search pages..." className="w-full bg-transparent p-4 border-b border-border outline-none" autoFocus />
        <div className="p-2 max-h-[300px] overflow-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-xs font-semibold text-muted-foreground p-2">{group.label}</div>
              {group.items.filter(i => !i.module || enabledModules.includes(i.module)).map(item => (
                <div key={item.href} className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer text-sm" onClick={() => {
                  router.push(item.href);
                  onOpenChange(false);
                }}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
