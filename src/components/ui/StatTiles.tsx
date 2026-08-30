import { cn, fmtDuration } from '@/lib/domain/helpers';
import type { StatRow } from '@/lib/domain/metrics';

/**
 * Bare stat tiles: a headline number with no comparison behind it, so there is
 * nothing to plot and no hover layer to add.
 */
export function StatTiles({ stats, compact = false }: { stats: StatRow[]; compact?: boolean }) {
  if (!stats.length) return null;

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.key} className={cn(!compact && 'bg-raasta-subtle rounded-xl px-3 py-2.5')}>
          <p className="text-[11px] text-raasta-muted truncate">{s.label}</p>
          <p
            className={cn(
              'font-semibold text-raasta-ink tabular-nums',
              compact ? 'text-sm' : 'text-lg mt-0.5',
            )}
          >
            {s.format === 'duration' ? fmtDuration(s.value) : s.value.toLocaleString('en-AE')}
          </p>
        </div>
      ))}
    </div>
  );
}
