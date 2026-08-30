/**
 * Date-range resolution for analytics.
 *
 * Analytics used to be month-only. Now every view runs off an explicit
 * { from, to } window so the same aggregation code serves a month, a single
 * operational week, a rolling window, or an admin-picked custom range.
 */
import { parseDateString, toDateString, todayDubai } from './weeks';
import { MONTHS } from './helpers';

export type RangePreset =
  | 'month'
  | 'last-month'
  | 'week'
  | 'last-7'
  | 'last-30'
  | 'custom';

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
  label: string;
}

/** Working days are Mon–Sat; Sunday is off. */
export function isWorkingDay(dateStr: string): boolean {
  return parseDateString(dateStr).getUTCDay() !== 0;
}

/** Adds `days` to a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const d = parseDateString(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

/** Every date string from `from` to `to`, inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Working days shared by two inclusive date ranges.
 *
 * Weekly targets are set for a whole Mon–Sat week. When a range slices a week
 * in half, the target counts for the share of the week that actually falls
 * inside the range — otherwise a 3-day window would be measured against a full
 * week's target and every member would read as failing.
 */
export function overlapWorkingDays(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): number {
  const from = aFrom > bFrom ? aFrom : bFrom;
  const to = aTo < bTo ? aTo : bTo;
  if (from > to) return 0;
  return eachDate(from, to).filter(isWorkingDay).length;
}

/** The share of a Mon–Sat week's target that belongs inside `range`. 0 → 1. */
export function weekOverlapFactor(
  weekStart: string,
  weekEnd: string,
  range: DateRange,
): number {
  const weekDays = eachDate(weekStart, weekEnd).filter(isWorkingDay).length;
  if (weekDays === 0) return 0;
  return overlapWorkingDays(weekStart, weekEnd, range.from, range.to) / weekDays;
}

/** First and last day of a calendar month. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return { from: toDateString(first), to: toDateString(last) };
}

/** Monday of the Mon–Sat week containing `dateStr`. */
export function mondayOfDate(dateStr: string): string {
  const d = parseDateString(dateStr);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return toDateString(d);
}

export function formatRangeLabel(from: string, to: string): string {
  const f = parseDateString(from);
  const t = parseDateString(to);
  const fmt = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth() + 1]?.slice(0, 3)}`;
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear();
  if (from === to) return `${fmt(f)} ${f.getUTCFullYear()}`;
  return sameYear
    ? `${fmt(f)} – ${fmt(t)} ${t.getUTCFullYear()}`
    : `${fmt(f)} ${f.getUTCFullYear()} – ${fmt(t)} ${t.getUTCFullYear()}`;
}

export interface RangeParams {
  preset?: string;
  month?: number;
  year?: number;
  from?: string;
  to?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turns URL search params into a concrete window. `monthRange` is supplied by
 * the caller (the operational weeks of that month, which straddle calendar
 * boundaries) so month analytics stay aligned to whole working weeks.
 */
export function resolveRange(
  params: RangeParams,
  monthRange: { from: string; to: string } | null,
  fallbackMonth: number,
  fallbackYear: number,
): { range: DateRange; preset: RangePreset } {
  const preset = (params.preset ?? 'month') as RangePreset;
  const month = params.month ?? fallbackMonth;
  const year = params.year ?? fallbackYear;
  const today = todayDubai();

  const monthWindow = monthRange ?? monthBounds(year, month);

  switch (preset) {
    case 'custom': {
      if (params.from && params.to && DATE_RE.test(params.from) && DATE_RE.test(params.to)) {
        const from = params.from <= params.to ? params.from : params.to;
        const to = params.from <= params.to ? params.to : params.from;
        return { range: { from, to, label: formatRangeLabel(from, to) }, preset };
      }
      break;
    }
    case 'week': {
      const from = params.from && DATE_RE.test(params.from) ? params.from : mondayOfDate(today);
      const to = addDays(from, 5);
      return { range: { from, to, label: `Week of ${formatRangeLabel(from, to)}` }, preset };
    }
    case 'last-7': {
      const from = addDays(today, -6);
      return { range: { from, to: today, label: 'Last 7 days' }, preset };
    }
    case 'last-30': {
      const from = addDays(today, -29);
      return { range: { from, to: today, label: 'Last 30 days' }, preset };
    }
    case 'last-month':
    case 'month':
    default:
      break;
  }

  return {
    range: {
      from: monthWindow.from,
      to: monthWindow.to,
      label: `${MONTHS[month]} ${year}`,
    },
    preset: preset === 'custom' ? 'month' : preset,
  };
}
