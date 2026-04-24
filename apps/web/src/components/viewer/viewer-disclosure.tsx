import { type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ViewerDisclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn('group border-t pt-4 [&[open]>summary>svg]:rotate-180', className)}
    >
      <summary className="flex items-center gap-2 cursor-pointer text-base text-muted-foreground hover:text-foreground list-none min-h-11 select-none">
        <span>{summary}</span>
        <ChevronDown size={18} className="transition-transform" aria-hidden />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
