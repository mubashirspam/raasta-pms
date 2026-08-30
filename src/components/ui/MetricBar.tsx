import { cn, fmtAED } from '@/lib/domain/helpers';
import { Check } from 'lucide-react';

export interface MetricBarProps {
  label: string;
  actual: number;
  /** Prorated target for the period. 0 means no target was ever set. */
  target: number;
  format?: 'number' | 'currency';
  className?: string;
}

const fmtNum = (v: number) =>
  Number.isInteger(v) ? v.toLocaleString('en-AE') : v.toLocaleString('en-AE', { maximumFractionDigits: 1 });

/**
 * Actual-vs-target for one metric. Achievement is a magnitude, so the fill keeps
 * a single brand hue; hitting the target is a *state* and gets an icon + word,
 * never colour on its own.
 */
export function MetricBar({ label, actual, target, format = 'number', className }: MetricBarProps) {
  const fmt = format === 'currency' ? fmtAED : fmtNum;
  const hasTarget = target > 0;
  const pct = hasTarget ? (actual / target) * 100 : 0;
  const met = hasTarget && actual >= target;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-raasta-muted truncate">{label}</span>
        <span className="text-xs tabular-nums text-raasta-faint shrink-0">
          {hasTarget ? `${Math.round(pct)}%` : 'no target'}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-sm font-semibold text-raasta-ink tabular-nums">{fmt(actual)}</span>
        {hasTarget && (
          <span className="text-xs text-raasta-faint tabular-nums">/ {fmt(Math.round(target))}</span>
        )}
        {met && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-ok-600">
            <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
            Met
          </span>
        )}
      </div>

      <div className="h-1.5 bg-raasta-subtle rounded-full overflow-hidden mt-1.5">
        <div
          className={cn('h-full rounded-full transition-all', met ? 'bg-ok-500' : 'bg-gold-400')}
          style={{ width: `${hasTarget ? Math.min(100, Math.max(pct, actual > 0 ? 2 : 0)) : 0}%` }}
        />
      </div>
    </div>
  );
}
