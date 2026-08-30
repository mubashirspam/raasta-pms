import { cn } from '@/lib/domain/helpers';
import { Check, X } from 'lucide-react';

type BadgeVariant = 'gold' | 'green' | 'red' | 'amber' | 'gray';

const variantClasses: Record<BadgeVariant, string> = {
  gold: 'bg-gold-50 text-gold-600 border-gold-200',
  green: 'bg-ok-50 text-ok-600 border-ok-500/25',
  red: 'bg-bad-50 text-bad-600 border-bad-500/25',
  amber: 'bg-warn-50 text-warn-500 border-warn-500/25',
  gray: 'bg-raasta-subtle text-raasta-muted border-raasta-border',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** On/below target status badge with icon */
export function StatusBadge({ onTarget, label }: { onTarget: boolean; label?: string }) {
  const Icon = onTarget ? Check : X;
  return (
    <Badge variant={onTarget ? 'green' : 'red'}>
      <Icon className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
      {label ?? (onTarget ? 'On Target' : 'Below Target')}
    </Badge>
  );
}
