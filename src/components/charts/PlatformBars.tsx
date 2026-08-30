'use client';

import { useState } from 'react';
import { cn } from '@/lib/domain/helpers';
import { Table2, BarChart3 } from 'lucide-react';

export interface PlatformDatum {
  platform: string;
  count: number;
}

/**
 * Colour follows the platform, never its rank — a filter that drops one series
 * must not repaint the rest. Bars therefore render in this fixed order rather
 * than sorted by value, which also keeps adjacent hues on the pairing that was
 * validated for colour-vision separation.
 */
const PLATFORM_COLORS: Record<string, string> = {
  YouTube: '#2a78d6',
  Instagram: '#eb6834',
  TikTok: '#1baf7a',
  Facebook: '#eda100',
  LinkedIn: '#e87ba4',
};
const FALLBACK_COLOR = '#6B6B72';

const PLATFORM_ORDER = ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn'];

function ordered(data: PlatformDatum[]): PlatformDatum[] {
  const byName = new Map(data.map((d) => [d.platform, d.count]));
  const known = PLATFORM_ORDER.filter((p) => byName.has(p)).map((p) => ({
    platform: p,
    count: byName.get(p)!,
  }));
  const extra = data.filter((d) => !PLATFORM_ORDER.includes(d.platform));
  return [...known, ...extra];
}

/**
 * Viral videos by platform. Three of these hues sit under 3:1 against the white
 * card, so every bar carries a visible name and value and a table view is one
 * tap away — identity never rests on colour alone.
 */
export function PlatformBars({
  data,
  className,
  emptyLabel = 'No viral videos recorded in this period.',
}: {
  data: PlatformDatum[];
  className?: string;
  emptyLabel?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const rows = ordered(data).filter((d) => d.count > 0);
  const total = rows.reduce((a, d) => a + d.count, 0);
  const max = rows.reduce((a, d) => Math.max(a, d.count), 0);

  if (!rows.length) {
    return <p className={cn('text-sm text-raasta-faint', className)}>{emptyLabel}</p>;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-raasta-muted">
          <span className="tabular-nums font-semibold text-raasta-ink">{total}</span> viral videos
        </p>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-raasta-muted hover:text-raasta-ink rounded-md px-1.5 py-1 hover:bg-raasta-subtle transition-colors"
        >
          {asTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-raasta-muted border-b border-raasta-line">
                <th className="font-medium py-1.5">Platform</th>
                <th className="font-medium py-1.5 text-right">Videos</th>
                <th className="font-medium py-1.5 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.platform} className="border-b border-raasta-line last:border-0">
                  <td className="py-1.5 text-raasta-ink">
                    <span
                      className="inline-block w-2 h-2 rounded-sm mr-2 align-middle"
                      style={{ background: PLATFORM_COLORS[d.platform] ?? FALLBACK_COLOR }}
                      aria-hidden="true"
                    />
                    {d.platform}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-raasta-ink">{d.count}</td>
                  <td className="py-1.5 text-right tabular-nums text-raasta-muted">
                    {Math.round((d.count / total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((d) => (
            <li key={d.platform} className="group">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs text-raasta-muted flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: PLATFORM_COLORS[d.platform] ?? FALLBACK_COLOR }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{d.platform}</span>
                </span>
                <span className="text-xs tabular-nums text-raasta-ink font-medium shrink-0">
                  {d.count}
                  <span className="text-raasta-faint font-normal ml-1.5">
                    {Math.round((d.count / total) * 100)}%
                  </span>
                </span>
              </div>
              <div
                className="h-2 bg-raasta-subtle rounded-full overflow-hidden"
                title={`${d.platform}: ${d.count} viral video${d.count === 1 ? '' : 's'} · ${Math.round((d.count / total) * 100)}% of ${total}`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${max > 0 ? Math.max(3, (d.count / max) * 100) : 0}%`,
                    background: PLATFORM_COLORS[d.platform] ?? FALLBACK_COLOR,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Compact inline platform chips — used inside per-member cards. */
export function PlatformChips({ data }: { data: PlatformDatum[] }) {
  const rows = ordered(data).filter((d) => d.count > 0);
  if (!rows.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((d) => (
        <span
          key={d.platform}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-raasta-border bg-raasta-subtle text-[11px] text-raasta-ink"
        >
          <span
            className="w-1.5 h-1.5 rounded-sm"
            style={{ background: PLATFORM_COLORS[d.platform] ?? FALLBACK_COLOR }}
            aria-hidden="true"
          />
          {d.platform}
          <span className="tabular-nums font-semibold">{d.count}</span>
        </span>
      ))}
    </div>
  );
}
