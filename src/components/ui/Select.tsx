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
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-sm',
            'focus:outline-none focus:border-gold-500/60 transition-colors appearance-none',
            error && 'border-red-500/60',
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
            <option key={o.value} value={o.value} className="bg-raasta-dark">
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
