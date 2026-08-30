/**
 * Week generator — pure domain function.
 *
 * Every month is divided into exactly four weeks by day-of-month:
 *   Week 1 = 1–7, Week 2 = 8–14, Week 3 = 15–21, Week 4 = 22 → end of month.
 *
 * Week 4 absorbs whatever the month has left, so it runs 7 days in February and
 * 10 in a 31-day month. Weeks never cross a month boundary, and every day of
 * the week is a working day — Sunday included.
 */

export interface GeneratedWeek {
  weekNumber: number;
  month: number;       // 1-12
  year: number;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  label: string;
}

/** The day-of-month each week begins on. */
export const WEEK_START_DAYS = [1, 8, 15, 22] as const;
export const WEEKS_PER_MONTH = WEEK_START_DAYS.length;

/** Returns a YYYY-MM-DD string for a Date in local time. */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/** Parses a YYYY-MM-DD string to a Date at midnight UTC. */
export function parseDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Number of days in a given month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateOf = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

/** Which of the four weeks a day-of-month belongs to (1-4). */
export function weekNumberForDay(day: number): number {
  // Everything from the 22nd on is week 4, however long the month runs.
  return day >= 22 ? 4 : Math.floor((day - 1) / 7) + 1;
}

/**
 * The four weeks of a month. Deterministic — no dependency on which weekday
 * the month happens to start on.
 */
export function generateWeeksForMonth(year: number, month: number): GeneratedWeek[] {
  const last = daysInMonth(year, month);

  return WEEK_START_DAYS.map((startDay, i) => {
    const isLast = i === WEEKS_PER_MONTH - 1;
    // The final week runs to the end of the month; the rest are 7 days.
    const endDay = isLast ? last : Math.min(startDay + 6, last);
    const weekNumber = i + 1;

    return {
      weekNumber,
      month,
      year,
      startDate: dateOf(year, month, startDay),
      endDate: dateOf(year, month, endDay),
      label: `Week ${weekNumber} of ${monthName(month)} ${year}`,
    };
  });
}

/** The week block containing a date, as { startDate, endDate, weekNumber }. */
export function weekBoundsFor(dateStr: string): {
  weekNumber: number;
  startDate: string;
  endDate: string;
} {
  const d = parseDateString(dateStr);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const weekNumber = weekNumberForDay(d.getUTCDate());
  const week = generateWeeksForMonth(year, month)[weekNumber - 1];
  return {
    weekNumber,
    startDate: week.startDate,
    endDate: week.endDate,
  };
}

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(month: number): string {
  return MONTHS[month] ?? '';
}

/**
 * Returns today's date string in Asia/Dubai timezone.
 */
export function todayDubai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns { month, year } for the current date in Asia/Dubai timezone.
 */
export function currentMonthYearDubai(): { month: number; year: number } {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    month: 'numeric',
    year: 'numeric',
  }).format(now);
  const [month, year] = formatted.split('/').map(Number);
  return { month, year };
}
