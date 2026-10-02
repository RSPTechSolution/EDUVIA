'use client';
import { cn } from '@/lib/utils';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';
import { CountUp } from './count-up';

interface StatCardProps {
  title:       string;
  value:       number | string;
  prefix?:     string;
  suffix?:     string;
  trend?:      number;
  trendLabel?: string;
  icon:        React.ElementType;
  iconColor?:  string;
  loading?:    boolean;
  onClick?:    () => void;
  className?:  string;
}

export function StatCard({
  title, value, prefix, suffix, trend, trendLabel = 'vs last period',
  icon: Icon, iconColor = 'text-primary', loading, onClick, className,
}: StatCardProps) {
  if (loading) return <StatCardSkeleton />;

  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;
  const TrendIcon = trendPositive ? ArrowUpIcon : trendNegative ? ArrowDownIcon : MinusIcon;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl bg-card border border-border',
        'p-6 shadow-card transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-hover hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-transparent" aria-hidden />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-xl font-semibold text-muted-foreground">{prefix}</span>}
            <span className="font-display text-display-sm font-bold text-foreground tabular-nums">
              {typeof value === 'number' ? <CountUp end={value} /> : value}
            </span>
            {suffix && <span className="text-xl font-semibold text-muted-foreground">{suffix}</span>}
          </div>
        </div>
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          'bg-primary/10 transition-colors group-hover:bg-primary/15',
        )}>
          <Icon className={cn('h-6 w-6', iconColor)} aria-hidden />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className={cn(
            'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
            trendPositive ? 'bg-success/10 text-success' :
            trendNegative ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground',
          )}>
            <TrendIcon className="h-3 w-3" aria-hidden />
            {Math.abs(trend)}%
          </span>
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="mt-4 h-4 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
