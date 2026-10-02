import { cn } from '@/lib/utils';

type Status = 'active' | 'inactive' | 'pending' | 'paid' | 'unpaid' | 'partial' |
              'present' | 'absent' | 'late' | 'approved' | 'rejected' | 'draft' |
              'published' | 'overdue' | 'expiring' | 'expired' | string;

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active:     { label: 'Active',     className: 'bg-success/10 text-success border-success/20' },
  inactive:   { label: 'Inactive',   className: 'bg-muted text-muted-foreground border-border' },
  pending:    { label: 'Pending',    className: 'bg-warning/10 text-warning border-warning/20' },
  paid:       { label: 'Paid',       className: 'bg-success/10 text-success border-success/20' },
  unpaid:     { label: 'Unpaid',     className: 'bg-destructive/10 text-destructive border-destructive/20' },
  partial:    { label: 'Partial',    className: 'bg-warning/10 text-warning border-warning/20' },
  present:    { label: 'Present',    className: 'bg-success/10 text-success border-success/20' },
  absent:     { label: 'Absent',     className: 'bg-destructive/10 text-destructive border-destructive/20' },
  late:       { label: 'Late',       className: 'bg-warning/10 text-warning border-warning/20' },
  approved:   { label: 'Approved',   className: 'bg-success/10 text-success border-success/20' },
  rejected:   { label: 'Rejected',   className: 'bg-destructive/10 text-destructive border-destructive/20' },
  draft:      { label: 'Draft',      className: 'bg-muted text-muted-foreground border-border' },
  published:  { label: 'Published',  className: 'bg-info/10 text-info border-info/20' },
  overdue:    { label: 'Overdue',    className: 'bg-destructive/10 text-destructive border-destructive/20' },
  expiring:   { label: 'Expiring',   className: 'bg-warning/10 text-warning border-warning/20' },
  expired:    { label: 'Expired',    className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = STATUS_MAP[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
      config.className, className,
    )}>
      {config.label}
    </span>
  );
}
