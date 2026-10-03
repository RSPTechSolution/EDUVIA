"use client";

import { useRouter } from "next/navigation";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useSession } from "@/components/session-provider";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { startNavigationProgress } from "@/components/navigation-progress";
import { visibleGroups } from "@/config/navigation";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const me = useSession();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search EDUVIA" description="Jump to a page or run an action">
      <Command filter={matchScore}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {visibleGroups(me).map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                onSelect={() => run(() => { startNavigationProgress(); router.push(item.href); })}
              >
                <item.icon aria-hidden />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem value="theme light" onSelect={() => run(() => setTheme("light"))}><Sun aria-hidden />Light theme</CommandItem>
          <CommandItem value="theme dark" onSelect={() => run(() => setTheme("dark"))}><Moon aria-hidden />Dark theme</CommandItem>
          <CommandItem value="theme system" onSelect={() => run(() => setTheme("system"))}><Monitor aria-hidden />System theme</CommandItem>
          <CommandItem value="sign out logout" onSelect={() => run(() => signOut())}>
            <LogOut aria-hidden />Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}

/** Every typed word must appear in the item; earlier and word-start matches rank higher. */
function matchScore(value: string, search: string) {
  const text = value.toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let score = 0;
  for (const w of words) {
    const at = text.indexOf(w);
    if (at < 0) return 0;
    const wordStart = at === 0 || text[at - 1] === " ";
    score += (wordStart ? 1 : 0.5) * (at === 0 ? 1.5 : 1);
  }
  return score / words.length / 1.5;
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}
