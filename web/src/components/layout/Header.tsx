'use client';
import { Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { NotificationCentre } from './NotificationCentre';
import { CommandPalette } from './CommandPalette';
import { Breadcrumb } from './Breadcrumb';
import { useState } from 'react';

export function Header({ onMobileMenuClick }: { onMobileMenuClick: () => void }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/60"
      role="banner">

      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuClick}
        aria-label="Open navigation menu" aria-expanded={false} aria-controls="mobile-nav">
        <Menu className="h-5 w-5" aria-hidden />
      </Button>

      <div className="hidden md:flex flex-1">
        <Breadcrumb items={[{label: "Dashboard"}]} />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm"
          className="hidden items-center gap-2 text-muted-foreground md:flex hover:text-foreground"
          onClick={() => setCmdOpen(true)} aria-label="Open command palette (Ctrl+K)">
          <Search className="h-4 w-4" aria-hidden />
          <span className="text-xs">Search...</span>
          <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </Button>

        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setCmdOpen(true)}
          aria-label="Search">
          <Search className="h-5 w-5" aria-hidden />
        </Button>

        <NotificationCentre open={notifOpen} onOpenChange={setNotifOpen} />
        <ThemeToggle />
        <UserMenu />
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}
