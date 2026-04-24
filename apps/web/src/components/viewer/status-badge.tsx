import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type LeaseStatus = 'PAID' | 'PENDING' | 'NO_INVOICE';
type Size = 'lg' | 'xl';

const config: Record<
  LeaseStatus,
  { Icon: typeof CheckCircle2; label: string; color: string }
> = {
  PAID: { Icon: CheckCircle2, label: 'Al día', color: 'text-green-600' },
  PENDING: { Icon: Clock, label: 'Pendiente', color: 'text-yellow-600' },
  NO_INVOICE: { Icon: AlertCircle, label: 'Sin factura', color: 'text-red-600' },
};

const sizes: Record<Size, { icon: number; text: string }> = {
  lg: { icon: 32, text: 'text-lg' },
  xl: { icon: 48, text: 'text-2xl' },
};

export function LeaseStatusBadge({
  status,
  size = 'lg',
  className,
}: {
  status: LeaseStatus;
  size?: Size;
  className?: string;
}) {
  const { Icon, label, color } = config[status];
  const { icon, text } = sizes[size];

  return (
    <div className={cn('flex items-center gap-3', color, className)}>
      <Icon size={icon} strokeWidth={2} aria-hidden />
      <span className={cn('font-semibold', text)}>{label}</span>
    </div>
  );
}
