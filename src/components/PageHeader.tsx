import { cn } from '@/lib/utils';
import { ReactNode, forwardRef } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, description, children, className }, ref) => {
    return (
      <div ref={ref} className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6", className)}>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
    );
  }
);

PageHeader.displayName = 'PageHeader';
