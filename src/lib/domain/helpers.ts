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
