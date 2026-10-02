import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-destructive/10 text-destructive ring-destructive/25",
  info: "bg-info/10 text-info ring-info/25",
  primary: "bg-primary/10 text-primary ring-primary/25",
  neutral: "bg-muted text-muted-foreground ring-border",
};

/** Default tone for common status words. Unknown words render neutral. */
const STATUS_TONE: Record<string, Tone> = {
  active: "success", enabled: "success", paid: "success", present: "success", approved: "success", valid: "success",
  inactive: "neutral", disabled: "neutral", draft: "neutral",
  pending: "warning", partial: "warning", late: "warning", expiring: "warning",
  suspended: "danger", unpaid: "danger", absent: "danger", rejected: "danger", overdue: "danger", expired: "danger",
  published: "info",
};

export function StatusBadge({
  status, label, tone, className, dot = true,
}: { status?: string; label?: string; tone?: Tone; className?: string; dot?: boolean }) {
  const t = tone ?? STATUS_TONE[status?.toLowerCase() ?? ""] ?? "neutral";
  const text = label ?? (status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[t], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {text}
    </span>
  );
}
