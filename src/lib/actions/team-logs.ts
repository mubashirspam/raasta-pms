'use server';

import { db } from '@/db';
import { dailyLogs, workingDayExceptions } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { monthBounds, eachDate } from '@/lib/domain/ranges';
import { parseDateString, todayDubai } from '@/lib/domain/weeks';

export type DayState =
  | 'present'   // log submitted, member was in
  | 'remote'    // log submitted, worked remotely
  | 'absent'    // log submitted, marked absent
  | 'missing'   // a past day with no log
  | 'off'       // declared holiday
  | 'future';   // not reachable yet

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  weekday: number; // 0 = Sunday
  state: DayState;
  logId: number | null;
  backdated: boolean;
}

/**
 * One entry per calendar day of the month describing whether this member has a
 * log for it. Drives the day chips on the admin daily-logs page — the admin
 * needs to see gaps, not just the days that were filled in.
 */
export async function getMemberLogCalendar(
  memberId: string,
  month: number,
  year: number,
): Promise<CalendarDay[]> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return [];

  const { from, to } = monthBounds(year, month);
  const today = todayDubai();

  const [logs, exceptions] = await Promise.all([
    db
      .select({
        id: dailyLogs.id,
        logDate: dailyLogs.logDate,
        attendance: dailyLogs.attendance,
        backdated: dailyLogs.backdated,
      })
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.memberId, memberId),
          gte(dailyLogs.logDate, from),
          lte(dailyLogs.logDate, to),
        ),
      ),
    db
      .select({
        exceptionDate: workingDayExceptions.exceptionDate,
        type: workingDayExceptions.type,
      })
      .from(workingDayExceptions)
      .where(
        and(
          gte(workingDayExceptions.exceptionDate, from),
          lte(workingDayExceptions.exceptionDate, to),
        ),
      ),
  ]);

  const byDate = new Map(logs.map((l) => [l.logDate, l]));
  // The team works seven days a week, so only a declared holiday is a day off.
  const holidays = new Set(
    exceptions.filter((e) => e.type === 'holiday').map((e) => e.exceptionDate),
  );

  return eachDate(from, to).map((date) => {
    const weekday = parseDateString(date).getUTCDay();
    const log = byDate.get(date);

    let state: DayState;
    if (log) {
      // Anything the form can record maps to its own chip; unknown values from
      // older rows fall back to "present" rather than vanishing.
      state = (['present', 'remote', 'absent'] as const).includes(
        log.attendance as never,
      )
        ? (log.attendance as DayState)
        : 'present';
    } else if (date > today) {
      state = 'future';
    } else if (holidays.has(date)) {
      state = 'off';
    } else {
      state = 'missing';
    }

    return {
      date,
      dayOfMonth: parseDateString(date).getUTCDate(),
      weekday,
      state,
      logId: log?.id ?? null,
      backdated: log?.backdated ?? false,
    };
  });
}

/**
 * A single day's log with every sub-record resolved to names, ready to render.
 * Returns null when nothing was submitted for that date.
 */
export async function getLogDetail(memberId: string, date: string) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return null;

  const log = await db.query.dailyLogs.findFirst({
    where: and(eq(dailyLogs.memberId, memberId), eq(dailyLogs.logDate, date)),
    with: {
      member: { with: { category: true, position: true } },
      developerVisits: true,
      creatorDailyMetrics: true,
      creatorAgentMetrics: { with: { agent: true } },
      shootParticipants: { with: { member: true } },
      viralPlatformCounts: { with: { agent: true } },
      extraWorkRecords: true,
    },
  });

  return log ?? null;
}

export type LogDetail = NonNullable<Awaited<ReturnType<typeof getLogDetail>>>;

/**
 * Month-level roll-up per member: how many logs landed, how many working days
 * were missed. Shown beside each name in the member picker.
 */
export async function getMonthSubmissionCounts(
  month: number,
  year: number,
  memberIds: string[],
): Promise<Record<string, { logged: number; absent: number }>> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin || memberIds.length === 0) return {};

  const { from, to } = monthBounds(year, month);

  const rows = await db
    .select({
      memberId: dailyLogs.memberId,
      attendance: dailyLogs.attendance,
    })
    .from(dailyLogs)
    .where(
      and(
        inArray(dailyLogs.memberId, memberIds),
        gte(dailyLogs.logDate, from),
        lte(dailyLogs.logDate, to),
      ),
    );

  const out: Record<string, { logged: number; absent: number }> = {};
  for (const r of rows) {
    const entry = (out[r.memberId] ??= { logged: 0, absent: 0 });
    entry.logged++;
    if (r.attendance === 'absent') entry.absent++;
  }
  return out;
}
