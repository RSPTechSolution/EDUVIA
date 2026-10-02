import { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Layers className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">EDUVIA <span className="text-muted-foreground font-normal">Super Admin</span></span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/super-admin" className="hover:text-primary transition-colors">Dashboard</Link>
          <Link href="/super-admin/schools" className="text-muted-foreground hover:text-primary transition-colors">Schools</Link>
          <Link href="/super-admin/plans" className="text-muted-foreground hover:text-primary transition-colors">Plans</Link>
          <div className="h-8 w-8 rounded-full bg-muted border border-border ml-2" />
        </div>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
