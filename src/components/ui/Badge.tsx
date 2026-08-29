import { cn } from '@/lib/domain/helpers';

type BadgeVariant = 'gold' | 'green' | 'red' | 'amber' | 'gray';

const variantClasses: Record<BadgeVariant, string> = {
  gold: 'bg-gold-500/10 text-gold-500 border-gold-500/20',
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  gray: 'bg-white/5 text-gray-400 border-white/10',
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
  return (
    <Badge variant={onTarget ? 'green' : 'red'}>
      {onTarget ? (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {label ?? (onTarget ? 'On Target' : 'Below Target')}
    </Badge>
  );
}
