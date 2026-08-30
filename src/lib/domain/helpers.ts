/**
 * Shared utility helpers used across server actions and components.
 */
import { nanoid } from 'nanoid';

/** Format a number as AED currency. */
export function fmtAED(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (isNaN(n)) return 'AED 0';
  return `AED ${n.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
}

/**
 * Format whole minutes as call time — "3h 45m", "45m", "2h".
 * Durations are stored as minutes; hours and minutes are only a UI concern.
 */
export function fmtDuration(totalMinutes: number | string | null | undefined): string {
  const total = Math.max(0, Math.round(Number(totalMinutes ?? 0)));
  if (!Number.isFinite(total) || total === 0) return '0m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Generate a short reference number like REF-A3BX2C9. */
export function generateRef(prefix = 'REF'): string {
  return `${prefix}-${nanoid(7).toUpperCase()}`;
}

/** Month display names. */
export const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Arrival timing options. */
export const ARRIVAL_TIMINGS = [
  'Before 9:00 AM',
  '9:00 AM – 9:59 AM',
  'After 9:59 AM',
] as const;

/** Combine two class strings, ignoring falsy values. */
export function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
