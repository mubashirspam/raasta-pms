import { cn } from '@/lib/domain/helpers';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-raasta-card border border-raasta-border rounded-xl p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-white font-semibold text-base', className)}>{children}</h2>
  );
}
