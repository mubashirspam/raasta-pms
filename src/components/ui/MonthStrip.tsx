'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, MONTHS } from '@/lib/domain/helpers';

interface Props {
  /** Today's month/year — the strip's fixed anchor. */
  currentMonth: number;
  currentYear: number;
  /** The month currently being viewed. */
  month: number;
  year: number;
  onSelect: (month: number, year: number) => void;
  /** How many months are visible at once. */
  size?: number;
}

/** Months as a single running index, so window maths is plain arithmetic. */
const toIndex = (m: number, y: number) => y * 12 + (m - 1);
const fromIndex = (i: number) => ({ m: (i % 12) + 1, y: Math.floor(i / 12) });

/**
 * A month picker whose window is anchored to *today*, not to the selection.
 *
 * Deriving the window from the selected month meant every pick redrew the strip
 * ending at that month, so choosing an earlier month hid every later one and
 * there was no way back. The window here only moves when the arrows move it.
 */
export function MonthStrip({
  currentMonth,
  currentYear,
  month,
  year,
  onSelect,
  size = 6,
}: Props) {
  const anchor = toIndex(currentMonth, currentYear);
  const selected = toIndex(month, year);

  // Furthest right the window may travel: today, or the selection if it is
  // somehow ahead of today.
  const maxEnd = Math.max(anchor, selected);

  const [end, setEnd] = useState(() => {
    if (selected > anchor) return selected;
    // An older selection sits at the left edge, newer months still reachable.
    if (selected < anchor - (size - 1)) return selected + (size - 1);
    return anchor;
  });

  const months = useMemo(
    () => Array.from({ length: size }, (_, i) => fromIndex(end - (size - 1) + i)),
    [end, size],
  );

  const atEnd = end >= maxEnd;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setEnd((e) => e - 1)}
        aria-label="Show earlier months"
        className="shrink-0 p-1.5 rounded-lg text-raasta-muted hover:text-raasta-ink hover:bg-raasta-subtle transition-colors"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 py-0.5">
        {months.map(({ m, y }) => {
          const active = m === month && y === year;
          const isCurrent = m === currentMonth && y === currentYear;
          return (
            <button
              key={`${y}-${m}`}
              type="button"
              onClick={() => onSelect(m, y)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                active
                  ? 'bg-gold-400 text-raasta-ink border-gold-400'
                  : 'bg-raasta-surface border-raasta-border text-raasta-muted hover:text-raasta-ink hover:border-raasta-faint/40',
                !active && isCurrent && 'border-gold-300 text-gold-700',
              )}
            >
              {MONTHS[m].slice(0, 3)} {String(y).slice(2)}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={atEnd}
        onClick={() => setEnd((e) => Math.min(maxEnd, e + 1))}
        aria-label="Show later months"
        className="shrink-0 p-1.5 rounded-lg text-raasta-muted hover:text-raasta-ink hover:bg-raasta-subtle transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-raasta-muted"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
