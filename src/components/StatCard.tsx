import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'bg-card border-border',
  accent: 'gradient-card-highlight border-accent/20',
  success: 'bg-card border-success/20',
  warning: 'bg-card border-warning/20',
  destructive: 'bg-card border-destructive/20',
};

const iconVariants = {
  default: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-xl border p-3.5 sm:p-5 shadow-card hover:shadow-card-hover transition-shadow h-full",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
          <p className="text-xs sm:text-base lg:text-lg font-bold text-foreground tracking-tight break-all leading-tight">{value}</p>
          {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{subtitle}</p>}
        </div>
        <div className={cn("p-2 sm:p-2.5 rounded-lg shrink-0", iconVariants[variant])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}
