import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ViewerSection({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm p-8 space-y-6',
        className,
      )}
    >
      {(title || subtitle || actions) && (
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
