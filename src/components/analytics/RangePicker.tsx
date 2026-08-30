'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn, MONTHS } from '@/lib/domain/helpers';
import type { OperationalWeek } from '@/db/schema';

interface Props {
  basePath: string;
  month: number;
  year: number;
  preset: string;
  weeks: OperationalWeek[];
  from: string;
  to: string;
}

const chip = (active: boolean) =>
  cn(
    'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
    active
      ? 'bg-gold-400 text-raasta-ink border-gold-400'
      : 'bg-raasta-surface border-raasta-border text-raasta-muted hover:text-raasta-ink hover:border-raasta-faint/40',
  );

/**
 * Period controls: months, the operational weeks inside the selected month,
 * rolling windows, and an explicit from–to range. Everything lives in the URL
 * so a period is linkable and survives a refresh.
 */
export function RangePicker({ basePath, month, year, preset, weeks, from, to }: Props) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [showCustom, setShowCustom] = useState(preset === 'custom');

  const go = (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    router.push(`${basePath}?${qs.toString()}`);
  };

  // Six months back from today, oldest first.
  const monthChips = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1);
    return { m: d.getMonth() + 1, y: d.getFullYear() };
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {monthChips.map(({ m, y }) => (
          <button
            key={`${y}-${m}`}
            type="button"
            onClick={() => go({ preset: 'month', month: m, year: y })}
            className={chip(preset === 'month' && m === month && y === year)}
          >
            {MONTHS[m].slice(0, 3)} {String(y).slice(2)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          type="button"
          onClick={() => go({ preset: 'last-7' })}
          className={chip(preset === 'last-7')}
        >
          Last 7 days
        </button>
        <button
          type="button"
          onClick={() => go({ preset: 'last-30' })}
          className={chip(preset === 'last-30')}
        >
          Last 30 days
        </button>
        <button
          type="button"
          onClick={() => {
            setShowCustom((v) => !v);
          }}
          className={chip(preset === 'custom')}
        >
          Custom range
        </button>
      </div>

      {weeks.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {weeks.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => go({ preset: 'week', from: w.startDate })}
              className={chip(preset === 'week' && from === w.startDate)}
              title={`${w.startDate} → ${w.endDate}`}
            >
              W{w.weekNumber}
            </button>
          ))}
        </div>
      )}

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2 bg-raasta-subtle border border-raasta-border rounded-xl p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-raasta-muted">From</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-raasta-surface border border-raasta-border rounded-lg px-2.5 py-1.5 text-xs text-raasta-ink focus:outline-none focus:border-gold-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-raasta-muted">To</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-raasta-surface border border-raasta-border rounded-lg px-2.5 py-1.5 text-xs text-raasta-ink focus:outline-none focus:border-gold-400"
            />
          </label>
          <button
            type="button"
            disabled={!customFrom || !customTo}
            onClick={() => go({ preset: 'custom', from: customFrom, to: customTo })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold-400 text-raasta-ink hover:bg-gold-300 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
