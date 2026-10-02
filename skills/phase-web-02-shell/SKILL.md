---
name: schoolerp-web-phase-02-shell
description: >
  Web Phase 2 — App shell: collapsible sidebar with role-aware module nav,
  sticky top header with command palette, breadcrumbs, notification centre,
  user menu, theme toggle, global search, and responsive mobile drawer.
  Use when building layout, navigation, sidebar, or header components.
---

# Web Phase 2 — App Shell & Navigation
## Next.js 15 App Router · shadcn/ui · Framer Motion

---

## File Structure

```
web/src/
├── app/
│   ├── layout.tsx                  ← root layout (fonts, providers, metadata)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   └── (dashboard)/
│       ├── layout.tsx              ← shell layout (sidebar + header + main)
│       ├── page.tsx                ← redirects to /dashboard
│       └── dashboard/page.tsx      ← main dashboard
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx            ← top-level shell wrapper
│   │   ├── Sidebar.tsx             ← collapsible sidebar
│   │   ├── SidebarNav.tsx          ← navigation items
│   │   ├── Header.tsx              ← top header bar
│   │   ├── CommandPalette.tsx      ← ⌘K global search
│   │   ├── NotificationCentre.tsx  ← notification bell + panel
│   │   ├── UserMenu.tsx            ← avatar dropdown
│   │   ├── Breadcrumb.tsx          ← page breadcrumbs
│   │   ├── MobileDrawer.tsx        ← mobile sidebar
│   │   └── ThemeToggle.tsx         ← light/dark/system
│   └── providers/
│       ├── ThemeProvider.tsx
│       ├── QueryProvider.tsx        ← React Query
│       └── AuthProvider.tsx
```

---

## Root Layout

```tsx
// web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { inter, plusJakarta, jetbrainsMono } from '@/lib/fonts';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  title: { default: 'SchoolERP', template: '%s | SchoolERP' },
  description: 'Professional school management system — students, fees, attendance, exams, and more.',
  keywords: ['school management', 'ERP', 'student management', 'fee management', 'attendance'],
  authors: [{ name: 'SchoolERP' }],
  robots: { index: false, follow: false },   // dashboard = no public indexing
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0E1117' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(inter.variable, plusJakarta.variable, jetbrainsMono.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
            <Toaster richColors closeButton position="bottom-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## Sidebar Navigation Config

```typescript
// web/src/config/navigation.ts
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Wallet,
  FileText, MessageSquare, Bus, UserCog, Library, Home, Shield,
  BrainCircuit, Building2, Settings, BarChart3, BookOpen,
  ClipboardList, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label:      string;
  href:       string;
  icon:       LucideIcon;
  badge?:     string | number;     // notification count
  badgeColor?:'default' | 'destructive' | 'warning';
  children?:  NavItem[];
  module?:    string;              // module slug — hidden if not enabled
  roles?:     string[];            // shown only for these roles
}

export interface NavGroup {
  label:    string;
  items:    NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
    ],
  },
  {
    label: 'Academic',
    items: [
      {
        label: 'Students',   href: '/students',    icon: Users,           module: 'students',
        children: [
          { label: 'All Students',    href: '/students',           icon: Users },
          { label: 'Admissions',      href: '/students/admissions',icon: GraduationCap },
          { label: 'Promotions',      href: '/students/promotions',icon: GraduationCap },
        ],
      },
      { label: 'Academics',    href: '/academics',   icon: BookOpen,        module: 'academics' },
      { label: 'Attendance',   href: '/attendance',  icon: CalendarCheck,   module: 'attendance' },
      { label: 'Examinations', href: '/exams',       icon: ClipboardList,   module: 'exams' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Fee Management', href: '/fees',       icon: Wallet,   module: 'fees' },
      { label: 'Accounts',       href: '/accounts',   icon: BarChart3,module: 'accounts' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Messages',    href: '/communication', icon: MessageSquare, module: 'communication' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Transport',  href: '/transport',   icon: Bus,      module: 'transport' },
      { label: 'Library',    href: '/library',     icon: Library,  module: 'library' },
      { label: 'Hostel',     href: '/hostel',      icon: Home,     module: 'hostel' },
      { label: 'Security',   href: '/security',    icon: Shield,   module: 'security' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'HR & Staff', href: '/hr',          icon: UserCog,  module: 'hr' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'AI Assistant', href: '/ai',        icon: BrainCircuit, module: 'ai' },
      { label: 'Analytics',    href: '/analytics', icon: BarChart3,    module: 'analytics' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['school_admin', 'principal'] },
    ],
  },
];
```

---

## Sidebar Component

```tsx
// web/src/components/layout/Sidebar.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, PanelLeftClose, PanelLeft, School } from 'lucide-react';
import { NAV_GROUPS, type NavItem } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SIDEBAR_KEY = 'schoolerp-sidebar-collapsed';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const { user } = useAuth();
  const { enabledModules } = useEnabledModules();

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved) setCollapsed(saved === 'true');
  }, []);

  const toggleCollapse = () => {
    setCollapsed(p => {
      localStorage.setItem(SIDEBAR_KEY, String(!p));
      return !p;
    });
  };

  const isVisible = (item: NavItem) => {
    if (item.module && !enabledModules.includes(item.module)) return false;
    if (item.roles && !item.roles.includes(user?.role ?? '')) return false;
    return true;
  };

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary">
          <School className="h-5 w-5 text-white" aria-hidden />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.15 }}>
              <p className="font-display text-sm font-bold text-sidebar-foreground leading-none">SchoolERP</p>
              <p className="text-[10px] text-sidebar-muted mt-0.5">{user?.school?.name ?? 'School'}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin" aria-label="Sidebar">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                  {group.label}
                </p>
              )}
              {visibleItems.map((item) => (
                <NavItemComponent key={item.href} item={item} collapsed={collapsed}
                  isActive={isActive} openGroups={openGroups} setOpenGroups={setOpenGroups} />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}

function NavItemComponent({ item, collapsed, isActive, openGroups, setOpenGroups }: any) {
  const active = isActive(item.href);
  const open = openGroups[item.href];
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const content = (
    <Link
      href={hasChildren ? '#' : item.href}
      onClick={hasChildren ? (e) => { e.preventDefault(); setOpenGroups((p: any) => ({ ...p, [item.href]: !open })); } : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent',
        active
          ? 'bg-sidebar-accent text-white shadow-sm'
          : 'text-sidebar-foreground hover:bg-sidebar-border hover:text-white',
        collapsed && 'justify-center px-2',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              item.badgeColor === 'destructive' ? 'bg-destructive text-white' : 'bg-primary/20 text-white',
            )}>{item.badge}</span>
          )}
          {hasChildren && (
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} aria-hidden />
          )}
        </>
      )}
    </Link>
  );

  return (
    <div className="px-2 mb-0.5">
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
        </Tooltip>
      ) : content}
      {hasChildren && !collapsed && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-4 py-1">
                {item.children.map((child: NavItem) => (
                  <Link key={child.href} href={child.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                      isActive(child.href)
                        ? 'bg-sidebar-accent/80 text-white'
                        : 'text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground',
                    )}
                    aria-current={isActive(child.href) ? 'page' : undefined}
                  >
                    <child.icon className="h-4 w-4 flex-shrink-0" aria-hidden />
                    {child.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
```

---

## Header Component

```tsx
// web/src/components/layout/Header.tsx
'use client';
import { Bell, Search, Menu } from 'lucide-react';
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

      {/* Mobile menu trigger */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuClick}
        aria-label="Open navigation menu" aria-expanded={false} aria-controls="mobile-nav">
        <Menu className="h-5 w-5" aria-hidden />
      </Button>

      {/* Breadcrumbs — hidden on mobile */}
      <div className="hidden md:flex flex-1">
        <Breadcrumb />
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Command palette trigger */}
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

        {/* Notifications */}
        <NotificationCentre open={notifOpen} onOpenChange={setNotifOpen} />

        {/* Theme */}
        <ThemeToggle />

        {/* User menu */}
        <UserMenu />
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}
```

---

## Command Palette (⌘K)

```tsx
// web/src/components/layout/CommandPalette.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { NAV_GROUPS } from '@/config/navigation';
import { useEnabledModules } from '@/hooks/useEnabledModules';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { enabledModules } = useEnabledModules();

  // ⌘K shortcut
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

  const navigate = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, students, features..." aria-label="Search command" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(i => !i.module || enabledModules.includes(i.module));
          if (items.length === 0) return null;
          return (
            <CommandGroup key={group.label} heading={group.label}>
              {items.map((item) => (
                <CommandItem key={item.href} onSelect={() => navigate(item.href)}
                  className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
```

---

## Antigravity Prompt for Web Phase 2

```
@file skills/master-plan/SKILL.md
@file skills/phase-web-01-design-system/SKILL.md
@file skills/phase-web-02-shell/SKILL.md

Build Web Phase 2 — App Shell:
1. Root layout.tsx with metadata, fonts, ThemeProvider, QueryProvider, Toaster
2. (auth)/login/layout.tsx — centered card layout, school logo, brand background
3. Login page: email + school slug + password form, React Hook Form + Zod, error states
4. (dashboard)/layout.tsx — Sidebar + Header + main content area, mobile drawer
5. Sidebar with collapsible animation (Framer Motion), role-aware nav items,
   tooltip on collapsed state, collapse toggle persisted to localStorage
6. Header: breadcrumbs, ⌘K command palette trigger, notification bell, theme toggle, user menu
7. Command palette (shadcn CommandDialog) with all nav items searchable
8. NotificationCentre: Sheet panel with unread count badge, notification list
9. UserMenu: avatar, role badge, school name, logout action
10. ThemeToggle: light/dark/system with smooth transition
11. MobileDrawer: Sheet overlay for sidebar on mobile
12. Run: pnpm build (no TypeScript errors) && pnpm test
```
