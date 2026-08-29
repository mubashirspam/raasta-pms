/**
 * Week generator — pure domain function.
 * Rules:
 *  - Working weeks run Monday → Saturday (6 days)
 *  - Each week is assigned to the calendar month in which ≥ 3 of its 6 working
 *    days fall. On a tie (exactly 3 days each) the week belongs to the month
 *    that contains the Monday.
 *  - Weeks are labelled "Week N of Month YYYY".
 */

export interface GeneratedWeek {
  weekNumber: number;
  month: number;       // 1-12
  year: number;
  startDate: string;   // YYYY-MM-DD (Monday)
  endDate: string;     // YYYY-MM-DD (Saturday)
  label: string;
}

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

/**
 * Returns the Monday of the ISO week containing `date`.
 */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  // getUTCDay(): 0 = Sunday, 1 = Monday … 6 = Saturday
  const dow = d.getUTCDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + daysToMonday);
  return d;
}

/**
 * Generates all Mon–Sat operational weeks relevant to a given year/month.
 *
 * "Relevant" means: every week whose 6 working days overlap with the requested
 * month at all, so the caller has the full picture for pagination and can
 * filter by assigned month themselves.
 */
export function generateWeeksForMonth(year: number, month: number): GeneratedWeek[] {
  // Start from the Monday of the week that contains the 1st of the month
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month - 1, 1));
  lastOfMonth.setUTCMonth(lastOfMonth.getUTCMonth() + 1);
  lastOfMonth.setUTCDate(lastOfMonth.getUTCDate() - 1); // last day of month

  let cursor = mondayOf(firstOfMonth);

  const weeks: GeneratedWeek[] = [];

  // Iterate until the Monday is past the end of the month
  while (cursor <= lastOfMonth) {
    const saturday = new Date(cursor);
    saturday.setUTCDate(saturday.getUTCDate() + 5);

    // Determine which month this week is assigned to
    const assignedMonth = assignWeekToMonth(cursor, saturday);

    weeks.push({
      weekNumber: 0, // set below per-month
      month: assignedMonth.month,
      year: assignedMonth.year,
      startDate: toDateString(cursor),
      endDate: toDateString(saturday),
      label: '', // set below
    });

    // Advance to the next Monday
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  // Also include the next week if the last Saturday ended exactly on the last
  // day of the month (edge-case: week straddles month boundary)
  if (weeks.length > 0) {
    const last = weeks[weeks.length - 1];
    if (last.endDate === toDateString(lastOfMonth)) {
      const nextMonday = new Date(cursor);
      const nextSaturday = new Date(nextMonday);
      nextSaturday.setUTCDate(nextSaturday.getUTCDate() + 5);
      const assignedMonth = assignWeekToMonth(nextMonday, nextSaturday);
      weeks.push({
        weekNumber: 0,
        month: assignedMonth.month,
        year: assignedMonth.year,
        startDate: toDateString(nextMonday),
        endDate: toDateString(nextSaturday),
        label: '',
      });
    }
  }

  // Assign sequential weekNumber per (month, year) and build label
  const counters = new Map<string, number>();
  for (const w of weeks) {
    const key = `${w.year}-${w.month}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    w.weekNumber = n;
    w.label = `Week ${n} of ${monthName(w.month)} ${w.year}`;
  }

  return weeks;
}

/**
 * Determines which month/year a Mon–Sat week is assigned to.
 *
 * Rule: count how many of the 6 working days fall in each calendar month.
 * The month with ≥ 3 days wins. On a tie (3 Mon/Tue/Wed vs 3 Thu/Fri/Sat)
 * the week goes to the month that contains Monday.
 */
function assignWeekToMonth(
  monday: Date,
  saturday: Date,
): { month: number; year: number } {
  const counts = new Map<string, { month: number; year: number; count: number }>();

  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    const key = `${y}-${m}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { month: m, year: y, count: 1 });
    }
  }

  let best: { month: number; year: number; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }

  // Tie-break: if two months tie (each with 3 days), use Monday's month
  if (best && best.count === 3 && counts.size > 1) {
    return { month: monday.getUTCMonth() + 1, year: monday.getUTCFullYear() };
  }

  return { month: best!.month, year: best!.year };
}

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthName(month: number): string {
  return MONTHS[month] ?? '';
}

/**
 * Checks whether a given date string (YYYY-MM-DD) is a Sunday
 * in the Asia/Dubai timezone.
 */
export function isSundayDubai(dateStr: string): boolean {
  // Parse as UTC midnight, then convert to Dubai time (UTC+4)
  const utcMs = parseDateString(dateStr).getTime();
  const dubaiMs = utcMs + 4 * 60 * 60 * 1000;
  const dubaiDate = new Date(dubaiMs);
  return dubaiDate.getUTCDay() === 0;
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
