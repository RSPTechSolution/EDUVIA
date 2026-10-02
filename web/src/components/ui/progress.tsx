import { cn } from '@/lib/utils';

export const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
    <div className="h-full bg-primary transition-all" style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
  </div>
)
