import { cn } from '@/lib/utils';
import { Breadcrumb } from './Breadcrumb';

interface PageHeaderProps {
  title:       string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?:    React.ReactNode;
  className?:  string;
}

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-1', className)}>
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-display-sm font-bold text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
