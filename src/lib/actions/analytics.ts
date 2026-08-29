'use server';

import { db } from '@/db';
import {
  dailyLogs,
  weeklyTargets,
  teamMembers,
  operationalWeeks,
  notifications,
  auditLog,
  correctionRequests,
} from '@/db/schema';
import { eq, and, gte, lte, desc, sum, count } from 'drizzle-orm';
import { isAdminAuthenticated } from '@/lib/auth-server';

export async function getOverviewAnalytics(month: number, year: number) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return null;

  // Get weeks for the month
  const weeks = await db.query.operationalWeeks.findMany({
    where: and(eq(operationalWeeks.month, month), eq(operationalWeeks.year, year)),
  });

  if (!weeks.length)
    return { weeks: [], memberSummaries: [], totalRevenue: 0, totalTarget: 0, cumulativeSeries: [] };

  const weekIds = weeks.map((w) => w.id);
  const startDate = weeks[0].startDate;
  const endDate = weeks[weeks.length - 1].endDate;

  // Aggregate revenue from daily logs in date range
  const [revenueResult] = await db
    .select({ total: sum(dailyLogs.salesRevenue) })
    .from(dailyLogs)
    .where(
      and(gte(dailyLogs.logDate, startDate), lte(dailyLogs.logDate, endDate)),
    );

  // Aggregate revenue targets
  const [targetResult] = await db
    .select({ total: sum(weeklyTargets.revenueTarget) })
    .from(weeklyTargets)
    .where(
      and(
        eq(weeklyTargets.weekId, weekIds[0]), // simplified — iterate in full impl
      ),
    );

  // Per-member summary
  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.isActive, true),
    with: {
      category: true,
      position: true,
    },
  });

  const memberSummaries = await Promise.all(
    members.map(async (m) => {
      const [rev] = await db
        .select({ total: sum(dailyLogs.salesRevenue) })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.memberId, m.id),
            gte(dailyLogs.logDate, startDate),
            lte(dailyLogs.logDate, endDate),
          ),
        );

      const [tgt] = await db
        .select({ total: sum(weeklyTargets.revenueTarget) })
        .from(weeklyTargets)
        .where(eq(weeklyTargets.memberId, m.id));

      const [logCount] = await db
        .select({ count: count() })
        .from(dailyLogs)
        .where(
          and(
            eq(dailyLogs.memberId, m.id),
            gte(dailyLogs.logDate, startDate),
            lte(dailyLogs.logDate, endDate),
          ),
        );

      return {
        member: m,
        revenue: Number(rev?.total ?? 0),
        target: Number(tgt?.total ?? 0),
        logsSubmitted: logCount?.count ?? 0,
        onTarget: Number(rev?.total ?? 0) >= Number(tgt?.total ?? 0),
      };
    }),
  );

  // Cumulative daily revenue for chart
  const dailyRevenueSeries = await db
    .select({
      logDate: dailyLogs.logDate,
      dailyRevenue: sum(dailyLogs.salesRevenue),
    })
    .from(dailyLogs)
    .where(and(gte(dailyLogs.logDate, startDate), lte(dailyLogs.logDate, endDate)))
    .groupBy(dailyLogs.logDate)
    .orderBy(dailyLogs.logDate);

  // Build cumulative series
  let cumulative = 0;
  const cumulativeSeries = dailyRevenueSeries.map((row) => {
    cumulative += Number(row.dailyRevenue ?? 0);
    return { date: row.logDate, cumulative };
  });

  return {
    weeks,
    memberSummaries,
    totalRevenue: Number(revenueResult?.total ?? 0),
    totalTarget: Number(targetResult?.total ?? 0),
    cumulativeSeries,
  };
}

export async function getMemberAnalytics(memberId: string, month: number, year: number) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return null;

  const weeks = await db.query.operationalWeeks.findMany({
    where: and(eq(operationalWeeks.month, month), eq(operationalWeeks.year, year)),
  });

  if (!weeks.length) return null;

  const startDate = weeks[0].startDate;
  const endDate = weeks[weeks.length - 1].endDate;

  const member = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
    with: { category: true, position: true },
  });

  if (!member) return null;

  const logs = await db.query.dailyLogs.findMany({
    where: and(
      eq(dailyLogs.memberId, memberId),
      gte(dailyLogs.logDate, startDate),
      lte(dailyLogs.logDate, endDate),
    ),
    with: { developerVisits: true, creatorDailyMetrics: true },
    orderBy: (t, { asc }) => [asc(t.logDate)],
  });

  const targets = await db.query.weeklyTargets.findMany({
    where: eq(weeklyTargets.memberId, memberId),
    with: { week: true },
  });

  return { member, logs, targets, weeks };
}

export async function getNotifications(unreadOnly = false) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return [];

  return db.query.notifications.findMany({
    where: unreadOnly ? eq(notifications.isRead, false) : undefined,
    with: { member: { with: { category: true, position: true } } },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 100,
  });
}

export async function markNotificationRead(notificationId: number) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));
}

export async function markAllNotificationsRead() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return;

  await db.update(notifications).set({ isRead: true });
}

export async function getAuditLog(limit = 50) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return [];

  return db.query.auditLog.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit,
  });
}
