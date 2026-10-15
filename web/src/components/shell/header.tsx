"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, KeyRound, LogOut, Menu, Search } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { signOut } from "@/lib/auth/sign-out";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fileUrl } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeMenu } from "@/components/shell/theme-menu";
import { findNavItem } from "@/config/navigation";
import { initials, roleLabel } from "@/lib/format";

function Breadcrumbs() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const trail = [{ label: "Home", href: "/dashboard" }];
  if (item && item.href !== "/dashboard") trail.push({ label: item.label, href: item.href });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={c.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-foreground">{c.label}</span>
              ) : (
                <Link href={c.href} className="truncate hover:text-foreground">{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function UserMenu() {
  const me = useSession();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-10 gap-2.5 px-1.5 sm:pr-3" aria-label="Account menu" />}
      >
        <Avatar>
          {me.photo_file_id && <AvatarImage src={fileUrl(me.photo_file_id)} alt="" />}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(me.full_name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-medium">{me.full_name}</span>
          <span className="block text-xs text-muted-foreground">{roleLabel(me.role)}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{me.full_name}</p>
            <p className="truncate text-xs">{me.email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}><KeyRound aria-hidden />My account</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}><LogOut aria-hidden />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ onOpenMobileNav, onOpenSearch }: { onOpenMobileNav: () => void; onOpenSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex print:hidden h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu className="size-5" aria-hidden />
      </Button>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          className="hidden h-9 w-64 justify-start gap-2 text-muted-foreground md:flex"
          onClick={onOpenSearch}
        >
          <Search className="size-4" aria-hidden />
          <span className="text-sm">Search…</span>
          <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenSearch} aria-label="Search">
          <Search className="size-[18px]" aria-hidden />
        </Button>
        <NotificationBell />
        <ThemeMenu />
        <UserMenu />
      </div>
    </header>
  );
}
