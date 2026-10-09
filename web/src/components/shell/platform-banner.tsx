"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Platform = { product_name: string; support_email: string | null; support_phone: string | null; banner: { text: string; tone: "info" | "warning" | "danger" } | null };

const TONE = { info: "bg-info/10 text-foreground border-info/30", warning: "bg-warning/15 text-foreground border-warning/40", danger: "bg-destructive/10 text-foreground border-destructive/40" };

/** The platform's announcement (e.g. planned maintenance), set by the platform admin. Can be hidden until the text changes. */
export function PlatformBanner() {
  const q = useQuery({ queryKey: ["platform", "public"], staleTime: 300_000, queryFn: async () => (await api<Platform>("/public/platform")).data });
  const banner = q.data?.banner;
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("eduvia.banner.hidden"));
    } catch {
      /* storage unavailable */
    }
  }, []);
  if (!banner || hidden === banner.text) return null;
  return (
    <div role="status" className={cn("flex items-center gap-3 border-b px-4 py-2 text-sm sm:px-6", TONE[banner.tone])}>
      <Megaphone className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">{banner.text}</p>
      <button type="button" aria-label="Hide this message" className="rounded p-1 hover:bg-foreground/10"
        onClick={() => { setHidden(banner.text); try { localStorage.setItem("eduvia.banner.hidden", banner.text); } catch { /* ignore */ } }}>
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
