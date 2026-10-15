"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, CalendarX, CheckCheck, Megaphone, Receipt, Trophy, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api/client";
import type { AppNotification } from "@/lib/api/types";
import { timeAgo } from "@/lib/format";
import { useNotificationCount, useNotifications } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  notice: Megaphone, homework: BookOpen, absent: CalendarX, fee_receipt: Receipt, results: Trophy,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const count = useNotificationCount();
  const list = useNotifications(open);
  const unread = count.data ?? 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.read) await api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => null);
    refresh();
    if (n.kind === "notice") qc.invalidateQueries({ queryKey: ["notices"] });
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    refresh();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) refresh(); }}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}>
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={readAll}><CheckCheck aria-hidden />Mark all read</Button>
          )}
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {list.isPending ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !list.data?.length ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground/50" aria-hidden />
              <p className="mt-2 text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">Notices, homework, fee receipts and results will show here.</p>
            </div>
          ) : (
            <ul role="list">
              {list.data.map((n) => {
                const Icon = ICONS[n.kind] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn("flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/60", !n.read && "bg-primary/5")}
                    >
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", n.kind === "absent" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                        {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
