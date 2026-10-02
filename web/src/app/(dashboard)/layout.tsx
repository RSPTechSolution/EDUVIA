'use client';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { School } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/80" onClick={() => setMobileDrawerOpen(false)} />
          <div className="relative flex w-72 flex-col bg-sidebar">
            <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 text-sidebar-foreground font-bold">
              <School className="h-5 w-5 text-sidebar-accent" />
              SchoolERP
            </div>
            {/* Minimal nav for mock */}
            <div className="p-4 text-sidebar-muted text-sm">
              <p>Navigate via Desktop view for full mock.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMobileMenuClick={() => setMobileDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
