'use server';

import { db } from '@/db';
import {
  dailyLogs,
  weeklyTargets,
  operationalWeeks,
  creatorDailyMetrics,
  creatorAgentDailyMetrics,
  viralPlatformCounts,
  VIRAL_PLATFORMS,
} from '@/db/schema';
import { eq, and, gte, lte, sum, count, sql } from 'drizzle-orm';
import { getCurrentMember } from '@/lib/auth-server';
import { weekOverlapFactor, monthBounds, type DateRange } from '@/lib/domain/ranges';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { MONTHS } from '@/lib/domain/helpers';
import {
  num as n,
  emptyTargets,
  accumulateTarget,
  buildMemberRows,
  type TargetTotals,
  type MetricRow,
  type StatRow,
  type PlatformCount,
  type MemberKind,
} from '@/lib/domain/metrics';

export interface MyAchievement {
  range: DateRange;
  kind: MemberKind;
  metrics: MetricRow[];
  cumulative: StatRow[];
  platforms: PlatformCount[];
  viralTotal: number;
  logsSubmitted: number;
  daysPresent: number;
  daysAbsent: number;
  /** How many of the metrics that carry a target have been met. */
  targetsMet: number;
  targetsSet: number;
}

/**
 * The signed-in member's own numbers for the current month.
 *
 * Takes no member id on purpose: the subject is always the caller's own record,
 * resolved from their session, so this can never be pointed at a colleague.
 */
export async function getMyAchievement(): Promise<MyAchievement | null> {
  const ctx = await getCurrentMember();
  if (!ctx) return null;

  const { member } = ctx;
  const memberId = member.id;

  const { month, year } = currentMonthYearDubai();
  const { from, to } = monthBounds(year, month);
  const range: DateRange = { from, to, label: `${MONTHS[month]} ${year}` };

  const mine = and(
    eq(dailyLogs.memberId, memberId),
    gte(dailyLogs.logDate, from),
    lte(dailyLogs.logDate, to),
  );

  const [salesRows, creatorRows, creditedRows, platformRows, creatorPlatformRows, targetRows] =
    await Promise.all([
      db
        .select({
          connectedCalls: sum(dailyLogs.connectedCalls),
          videoCalls: sum(dailyLogs.videoCalls),
          faceToFace: sum(dailyLogs.faceToFace),
          revenue: sum(dailyLogs.salesRevenue),
          leadsReceived: sum(dailyLogs.leadsReceived),
          organicCallMinutes: sum(dailyLogs.organicCallMinutes),
          marketingCallMinutes: sum(dailyLogs.marketingCallMinutes),
          logs: count(),
          present: sql<number>`count(*) filter (where ${dailyLogs.attendance} = 'present')`,
          absent: sql<number>`count(*) filter (where ${dailyLogs.attendance} = 'absent')`,
        })
        .from(dailyLogs)
        .where(mine),

      db
        .select({
          reels: sum(creatorDailyMetrics.reelsGiven),
          viral: sum(creatorDailyMetrics.viralVideos),
          leads: sum(creatorDailyMetrics.leadsGenerated),
          teamVideos: sum(creatorDailyMetrics.instagramVideos),
        })
        .from(creatorDailyMetrics)
        .innerJoin(dailyLogs, eq(creatorDailyMetrics.logId, dailyLogs.id))
        .where(mine),

      // What creators delivered for this member, when they are a sales agent.
      db
        .select({
          reels: sum(creatorAgentDailyMetrics.reelsGiven),
          viral: sum(creatorAgentDailyMetrics.viralVideos),
          leads: sum(creatorAgentDailyMetrics.leadsGenerated),
        })
        .from(creatorAgentDailyMetrics)
        .innerJoin(dailyLogs, eq(creatorAgentDailyMetrics.logId, dailyLogs.id))
        .where(
          and(
            eq(creatorAgentDailyMetrics.agentId, memberId),
            gte(dailyLogs.logDate, from),
            lte(dailyLogs.logDate, to),
          ),
        ),

      // Viral videos credited to this member as the agent they were made for.
      db
        .select({ platform: viralPlatformCounts.platform, total: sum(viralPlatformCounts.count) })
        .from(viralPlatformCounts)
        .innerJoin(dailyLogs, eq(viralPlatformCounts.logId, dailyLogs.id))
        .where(
          and(
            eq(viralPlatformCounts.agentId, memberId),
            gte(dailyLogs.logDate, from),
            lte(dailyLogs.logDate, to),
          ),
        )
        .groupBy(viralPlatformCounts.platform),

      // …and those this member produced, when they are a creator.
      db
        .select({ platform: viralPlatformCounts.platform, total: sum(viralPlatformCounts.count) })
        .from(viralPlatformCounts)
        .innerJoin(dailyLogs, eq(viralPlatformCounts.logId, dailyLogs.id))
        .where(mine)
        .groupBy(viralPlatformCounts.platform),

      db
        .select({
          agentId: weeklyTargets.agentId,
          memberId: weeklyTargets.memberId,
          startDate: operationalWeeks.startDate,
          endDate: operationalWeeks.endDate,
          connectedCallsTarget: weeklyTargets.connectedCallsTarget,
          videoCallsTarget: weeklyTargets.videoCallsTarget,
          faceToFaceTarget: weeklyTargets.faceToFaceTarget,
          revenueTarget: weeklyTargets.revenueTarget,
          reelsTarget: weeklyTargets.reelsTarget,
          viralVideosTarget: weeklyTargets.viralVideosTarget,
          leadsTarget: weeklyTargets.leadsTarget,
          teamVideosTarget: weeklyTargets.teamVideosTarget,
        })
        .from(weeklyTargets)
        .innerJoin(operationalWeeks, eq(weeklyTargets.weekId, operationalWeeks.id))
        .where(
          and(
            lte(operationalWeeks.startDate, to),
            gte(operationalWeeks.endDate, from),
            // Targets this member set, plus those creators set on their behalf.
            sql`(${weeklyTargets.memberId} = ${memberId} or ${weeklyTargets.agentId} = ${memberId})`,
          ),
        ),
    ]);

  const kind: MemberKind =
    member.category.name === 'Content Creator'
      ? 'creator'
      : member.category.name === 'Sales Agent'
      ? 'sales'
      : 'other';

  const ownTargets: TargetTotals = emptyTargets();
  const agentTargets: TargetTotals = emptyTargets();

  for (const r of targetRows) {
    const f = weekOverlapFactor(r.startDate, r.endDate, range);
    if (f <= 0) continue;
    if (r.memberId === memberId) accumulateTarget(ownTargets, r, f);
    if (r.agentId === memberId) {
      agentTargets.reels += n(r.reelsTarget) * f;
      agentTargets.viral += n(r.viralVideosTarget) * f;
      agentTargets.leads += n(r.leadsTarget) * f;
    }
  }

  const rawPlatforms = kind === 'creator' ? creatorPlatformRows : platformRows;
  const byName = new Map(rawPlatforms.map((r) => [r.platform, n(r.total)]));
  const platforms: PlatformCount[] = VIRAL_PLATFORMS.filter((p) => (byName.get(p) ?? 0) > 0).map(
    (p) => ({ platform: p as string, count: byName.get(p)! }),
  );
  const viralTotal = platforms.reduce((a, p) => a + p.count, 0);

  const sales = salesRows[0];
  const { metrics, cumulative } = buildMemberRows({
    kind,
    sales,
    creator: creatorRows[0],
    credited: creditedRows[0],
    viralTotal,
    ownTargets,
    agentTargets,
  });

  const scored = metrics.filter((m) => m.target > 0);

  return {
    range,
    kind,
    metrics,
    cumulative,
    platforms,
    viralTotal,
    logsSubmitted: n(sales?.logs),
    daysPresent: n(sales?.present),
    daysAbsent: n(sales?.absent),
    targetsMet: scored.filter((m) => m.actual >= m.target).length,
    targetsSet: scored.length,
  };
}
