import { cn } from '@/lib/domain/helpers';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-raasta-muted">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-raasta-surface border border-raasta-border rounded-xl px-3.5 py-2.5 text-raasta-ink text-sm',
            'placeholder-raasta-faint transition-shadow',
            'focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25',
            error && 'border-bad-500 focus:border-bad-500 focus:ring-bad-500/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-bad-500">{error}</p>}
        {hint && !error && <p className="text-xs text-raasta-faint">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
