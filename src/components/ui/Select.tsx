import { cn } from '@/lib/domain/helpers';
import { forwardRef } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
  options: { value: string | number; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, placeholder, options, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-xs font-medium text-raasta-muted">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full bg-raasta-surface border border-raasta-border rounded-xl pl-3.5 pr-9 py-2.5 text-raasta-ink text-sm',
              'appearance-none transition-shadow',
              'focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25',
              error && 'border-bad-500',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {/* Chevron — appearance-none removes the native one. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-raasta-faint"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {error && <p className="text-xs text-bad-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
