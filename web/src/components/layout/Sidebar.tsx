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
