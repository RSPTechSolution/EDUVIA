import { Loader2 } from "lucide-react";
import { ProgressHold } from "@/components/navigation-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Floating "Loading…" pill so it's obvious the page is on its way. */
export function LoadingPill({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border bg-card/95 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur",
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}

/** Shown by `loading.tsx` while a dashboard page loads: the page's shape plus a clear status. */
export function AppPageLoader() {
  return (
    <div className="relative" aria-busy="true">
      <ProgressHold />
      <div className="sticky top-20 z-20 flex justify-center">
        <LoadingPill className="-mb-10" />
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Full-height centred loader for public pages. */
export function CenteredLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <ProgressHold />
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
        <span className="relative flex size-14 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" aria-hidden />
          <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
          </span>
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
