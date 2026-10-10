"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { useState } from "react";
import { BANNER_COOKIE } from "@/components/shell/shell-cookies";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export type Platform = { product_name: string; support_email: string | null; support_phone: string | null; banner: { text: string; tone: "info" | "warning" | "danger" } | null };

const TONE = { info: "bg-info/10 text-foreground border-info/30", warning: "bg-warning/15 text-foreground border-warning/40", danger: "bg-destructive/10 text-foreground border-destructive/40" };

/** A short, stable id for an announcement's text; a new text gets a new id, so it shows again. */
function bannerId(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The platform's announcement (e.g. planned maintenance), set by the platform admin. Can be hidden until the text changes.
 *  The server passes the first copy in, so the banner is in place on the first paint instead of pushing the page down. */
export function PlatformBanner({ initial, hiddenId }: { initial: Platform | null; hiddenId: string | null }) {
  const q = useQuery({
    queryKey: ["platform", "public"], staleTime: 300_000, initialData: initial ?? undefined,
    queryFn: async () => (await api<Platform>("/public/platform")).data,
  });
  const banner = q.data?.banner;
  const [hidden, setHidden] = useState(hiddenId);
  if (!banner || hidden === bannerId(banner.text)) return null;
  return (
    <div role="status" className={cn("flex items-center gap-3 border-b px-4 py-2 text-sm sm:px-6", TONE[banner.tone])}>
      <Megaphone className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">{banner.text}</p>
      <button type="button" aria-label="Hide this message" className="rounded p-1 hover:bg-foreground/10"
        onClick={() => {
          const id = bannerId(banner.text);
          setHidden(id);
          document.cookie = `${BANNER_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
        }}>
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
