import { cn } from '@/lib/domain/helpers';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-raasta-surface border border-raasta-border rounded-2xl p-4 shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('text-raasta-ink font-semibold text-base tracking-tight', className)}>
      {children}
    </h2>
  );
}

export function CardHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-raasta-muted mt-1">{children}</p>;
}
