'use server';

import { db } from '@/db';
import {
  dailyLogs,
  weeklyTargets,
  teamMembers,
  operationalWeeks,
  creatorDailyMetrics,
  creatorAgentDailyMetrics,
  creatorTeamAgents,
  viralPlatformCounts,
  notifications,
  auditLog,
  VIRAL_PLATFORMS,
} from '@/db/schema';
import { eq, and, gte, lte, sum, count, sql } from 'drizzle-orm';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { weekOverlapFactor, type DateRange } from '@/lib/domain/ranges';
import {
  num as n,
  metric,
  stat,
  emptyTargets,
  accumulateTarget,
  buildMemberRows,
  type TargetTotals,
  type MetricRow,
  type StatRow,
  type PlatformCount,
  type MemberKind,
  type MemberLink,
  type MemberAnalytics,
  type RangeAnalytics,
} from '@/lib/domain/metrics';

// Shapes, row builders and target maths live in the domain module so the
// member's own home-screen summary builds identical rows.
export type {
  MetricFormat,
  MetricRow,
  PlatformCount,
  StatRow,
  MemberKind,
  MemberLink,
  MemberAnalytics,
  RangeAnalytics,
} from '@/lib/domain/metrics';

type LocalTargetTotals = TargetTotals;

/**
 * Weekly targets that overlap the range, each scaled to the share of its week
 * that actually falls inside it. Returns targets keyed two ways:
 *  - `byOwner`: what the member committed to (a creator's rows roll up here)
 *  - `byAgent`: what creators committed to deliver *for* a given sales agent
 */
async function collectTargets(range: DateRange) {
  const rows = await db
    .select({
      memberId: weeklyTargets.memberId,
      agentId: weeklyTargets.agentId,
      startDate: operationalWeeks.startDate,
      endDate: operationalWeeks.endDate,
      connectedCallsTarget: weeklyTargets.connectedCallsTarget,
      videoCallsTarget: weeklyTargets.videoCallsTarget,
      faceToFaceTarget: weeklyTargets.faceToFaceTarget,
      revenueTarget: weeklyTargets.revenueTarget,
      reelsTarget: weeklyTargets.reelsTarget,
      viralVideosTarget: weeklyTargets.viralVideosTarget,
      leadsTarget: weeklyTargets.leadsTarget,
      picsTarget: weeklyTargets.picsTarget,
      teamVideosTarget: weeklyTargets.teamVideosTarget,
    })
    .from(weeklyTargets)
    .innerJoin(operationalWeeks, eq(weeklyTargets.weekId, operationalWeeks.id))
    // Any week that touches the range at all; the factor handles the edges.
    .where(
      and(
        lte(operationalWeeks.startDate, range.to),
        gte(operationalWeeks.endDate, range.from),
      ),
    );

  const byOwner = new Map<string, LocalTargetTotals>();
  const byAgent = new Map<string, LocalTargetTotals>();
  const company = emptyTargets();

  for (const r of rows) {
    const f = weekOverlapFactor(r.startDate, r.endDate, range);
    if (f <= 0) continue;

    const owner = byOwner.get(r.memberId) ?? emptyTargets();
    accumulateTarget(owner, r, f);
    byOwner.set(r.memberId, owner);

    accumulateTarget(company, r, f);

    // Creator rows carry an agentId: that agent is the one being delivered for.
    if (r.agentId) {
      const agent = byAgent.get(r.agentId) ?? emptyTargets();
      agent.reels += n(r.reelsTarget) * f;
      agent.viral += n(r.viralVideosTarget) * f;
      agent.leads += n(r.leadsTarget) * f;
      agent.pics += n(r.picsTarget) * f;
      byAgent.set(r.agentId, agent);
    }
  }

  return { byOwner, byAgent, company };
}

// ─── Main aggregation ──────────────────────────────────────────────────────────

/**
 * Every tracked metric — not just revenue — for an arbitrary date window,
 * company-wide and per person, with viral videos broken out by platform.
 */
export async function getRangeAnalytics(range: DateRange): Promise<RangeAnalytics | null> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return null;

  const inRange = and(
    gte(dailyLogs.logDate, range.from),
    lte(dailyLogs.logDate, range.to),
  );

  const [
    members,
    salesRows,
    creatorRows,
    creditedRows,
    platformRows,
    creatorPlatformRows,
    dailyRevenueSeries,
    rosterRows,
    targets,
  ] = await Promise.all([
    db.query.teamMembers.findMany({
      with: { category: true, position: true },
      orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.fullName)],
    }),

    // Sales-side actuals straight off the log.
    db
      .select({
        memberId: dailyLogs.memberId,
        connectedCalls: sum(dailyLogs.connectedCalls),
        connectedSelfCircle: sum(dailyLogs.connectedSelfCircle),
        videoCalls: sum(dailyLogs.videoCalls),
        faceToFace: sum(dailyLogs.faceToFace),
        organicCallMinutes: sum(dailyLogs.organicCallMinutes),
        marketingCallMinutes: sum(dailyLogs.marketingCallMinutes),
        revenue: sum(dailyLogs.salesRevenue),
        teamRevenue: sum(dailyLogs.teamRevenue),
        reelsUploaded: sum(dailyLogs.reelsUploaded),
        leadsReceived: sum(dailyLogs.leadsReceived),
        logs: count(),
        present: sql<number>`count(*) filter (where ${dailyLogs.attendance} = 'present')`,
        remote: sql<number>`count(*) filter (where ${dailyLogs.attendance} = 'remote')`,
        absent: sql<number>`count(*) filter (where ${dailyLogs.attendance} = 'absent')`,
      })
      .from(dailyLogs)
      .where(inRange)
      .groupBy(dailyLogs.memberId),

    // Creator roll-ups, keyed by the creator who filed the log.
    db
      .select({
        memberId: dailyLogs.memberId,
        reels: sum(creatorDailyMetrics.reelsGiven),
        viral: sum(creatorDailyMetrics.viralVideos),
        leads: sum(creatorDailyMetrics.leadsGenerated),
        pics: sum(creatorDailyMetrics.picsGiven),
        teamVideos: sum(creatorDailyMetrics.instagramVideos),
      })
      .from(creatorDailyMetrics)
      .innerJoin(dailyLogs, eq(creatorDailyMetrics.logId, dailyLogs.id))
      .where(inRange)
      .groupBy(dailyLogs.memberId),

    // What creators delivered *to* each sales agent.
    db
      .select({
        agentId: creatorAgentDailyMetrics.agentId,
        reels: sum(creatorAgentDailyMetrics.reelsGiven),
        viral: sum(creatorAgentDailyMetrics.viralVideos),
        leads: sum(creatorAgentDailyMetrics.leadsGenerated),
        pics: sum(creatorAgentDailyMetrics.picsGiven),
      })
      .from(creatorAgentDailyMetrics)
      .innerJoin(dailyLogs, eq(creatorAgentDailyMetrics.logId, dailyLogs.id))
      .where(inRange)
      .groupBy(creatorAgentDailyMetrics.agentId),

    // Viral videos per platform, credited to the agent they were made for.
    db
      .select({
        agentId: viralPlatformCounts.agentId,
        platform: viralPlatformCounts.platform,
        total: sum(viralPlatformCounts.count),
      })
      .from(viralPlatformCounts)
      .innerJoin(dailyLogs, eq(viralPlatformCounts.logId, dailyLogs.id))
      .where(inRange)
      .groupBy(viralPlatformCounts.agentId, viralPlatformCounts.platform),

    // …and the same counts attributed to the creator who produced them.
    db
      .select({
        creatorId: dailyLogs.memberId,
        platform: viralPlatformCounts.platform,
        total: sum(viralPlatformCounts.count),
      })
      .from(viralPlatformCounts)
      .innerJoin(dailyLogs, eq(viralPlatformCounts.logId, dailyLogs.id))
      .where(inRange)
      .groupBy(dailyLogs.memberId, viralPlatformCounts.platform),

    db
      .select({ logDate: dailyLogs.logDate, dailyRevenue: sum(dailyLogs.salesRevenue) })
      .from(dailyLogs)
      .where(inRange)
      .groupBy(dailyLogs.logDate)
      .orderBy(dailyLogs.logDate),

    // The creator↔agent roster, so each card can name the people on the other
    // side of the link regardless of what was logged in the period.
    db
      .select({
        creatorId: creatorTeamAgents.creatorId,
        agentId: creatorTeamAgents.agentId,
        displayOrder: creatorTeamAgents.displayOrder,
      })
      .from(creatorTeamAgents)
      .orderBy(creatorTeamAgents.displayOrder),

    collectTargets(range),
  ]);

  // A creator's agents, and an agent's creators — both off the same roster.
  const memberById = new Map(members.map((m) => [m.id, m]));
  const toLink = (id: string): MemberLink | null => {
    const m = memberById.get(id);
    return m
      ? {
          memberId: m.id,
          fullName: m.fullName,
          memberCode: m.memberCode,
          positionName: m.position.name,
        }
      : null;
  };
  const agentsByCreator = new Map<string, MemberLink[]>();
  const creatorsByAgent = new Map<string, MemberLink[]>();
  for (const r of rosterRows) {
    const agent = toLink(r.agentId);
    if (agent) {
      const list = agentsByCreator.get(r.creatorId) ?? [];
      list.push(agent);
      agentsByCreator.set(r.creatorId, list);
    }
    const creator = toLink(r.creatorId);
    if (creator) {
      const list = creatorsByAgent.get(r.agentId) ?? [];
      list.push(creator);
      creatorsByAgent.set(r.agentId, list);
    }
  }

  const salesByMember = new Map(salesRows.map((r) => [r.memberId, r]));
  const creatorByMember = new Map(creatorRows.map((r) => [r.memberId, r]));
  const creditedByAgent = new Map(creditedRows.map((r) => [r.agentId, r]));

  // platform → count, per agent and per creator
  const platformsByAgent = new Map<string, Map<string, number>>();
  for (const r of platformRows) {
    const m = platformsByAgent.get(r.agentId) ?? new Map<string, number>();
    m.set(r.platform, (m.get(r.platform) ?? 0) + n(r.total));
    platformsByAgent.set(r.agentId, m);
  }
  const platformsByCreator = new Map<string, Map<string, number>>();
  const companyPlatforms = new Map<string, number>();
  for (const r of creatorPlatformRows) {
    const m = platformsByCreator.get(r.creatorId) ?? new Map<string, number>();
    m.set(r.platform, (m.get(r.platform) ?? 0) + n(r.total));
    platformsByCreator.set(r.creatorId, m);
    companyPlatforms.set(r.platform, (companyPlatforms.get(r.platform) ?? 0) + n(r.total));
  }

  /** Ordered platform list, VIRAL_PLATFORMS first so colours stay stable. */
  const orderPlatforms = (m: Map<string, number> | undefined): PlatformCount[] => {
    if (!m) return [];
    const known = VIRAL_PLATFORMS.filter((p) => (m.get(p) ?? 0) > 0).map((p) => ({
      platform: p as string,
      count: m.get(p)!,
    }));
    const extra = [...m.entries()]
      .filter(([p, c]) => c > 0 && !VIRAL_PLATFORMS.includes(p as never))
      .map(([platform, count]) => ({ platform, count }));
    return [...known, ...extra];
  };

  const memberSummaries: MemberAnalytics[] = members.map((m) => {
    const s = salesByMember.get(m.id);
    const c = creatorByMember.get(m.id);
    const credited = creditedByAgent.get(m.id);
    const ownTargets = targets.byOwner.get(m.id) ?? emptyTargets();
    const agentTargets = targets.byAgent.get(m.id) ?? emptyTargets();

    const kind: MemberKind =
      m.category.name === 'Content Creator'
        ? 'creator'
        : m.category.name === 'Sales Agent'
        ? 'sales'
        : 'other';

    const platforms: PlatformCount[] = orderPlatforms(
      kind === 'creator' ? platformsByCreator.get(m.id) : platformsByAgent.get(m.id),
    );
    const viralTotal = platforms.reduce((a, p) => a + p.count, 0);

    const { metrics, cumulative } = buildMemberRows({
      kind,
      sales: s,
      creator: c,
      credited,
      viralTotal,
      ownTargets,
      agentTargets,
    });

    return {
      memberId: m.id,
      fullName: m.fullName,
      memberCode: m.memberCode,
      categoryName: m.category.name,
      positionName: m.position.name,
      kind,
      metrics,
      cumulative,
      platforms,
      viralTotal,
      logsSubmitted: n(s?.logs),
      daysPresent: n(s?.present),
      daysRemote: n(s?.remote),
      daysAbsent: n(s?.absent),
      connections:
        (kind === 'creator' ? agentsByCreator.get(m.id) : creatorsByAgent.get(m.id)) ?? [],
    };
  });

  // Company-wide actuals
  const sumOf = <T,>(rows: T[], pick: (r: T) => unknown) =>
    rows.reduce((a, r) => a + n(pick(r)), 0);

  const companyViral = [...companyPlatforms.values()].reduce((a, b) => a + b, 0);
  const revenueActual = sumOf(salesRows, (r) => r.revenue);

  const totals: MetricRow[] = [
    metric('revenue', 'Revenue', revenueActual, targets.company.revenue, 'currency'),
    metric(
      'connectedCalls',
      'Connected Calls',
      sumOf(salesRows, (r) => r.connectedCalls),
      targets.company.connectedCalls,
    ),
    metric('videoCalls', 'Video Calls', sumOf(salesRows, (r) => r.videoCalls), targets.company.videoCalls),
    metric('faceToFace', 'Face-to-Face', sumOf(salesRows, (r) => r.faceToFace), targets.company.faceToFace),
    metric('reels', 'Reels Given', sumOf(creatorRows, (r) => r.reels), targets.company.reels),
    metric('viral', 'Viral Videos (100K+ Views)', companyViral, targets.company.viral),
    metric('leads', 'Leads Generated', sumOf(creatorRows, (r) => r.leads), targets.company.leads),
    metric(
      'pics',
      'Pics / Carousel / Poster',
      sumOf(creatorRows, (r) => r.pics),
      targets.company.pics,
    ),
    metric(
      'teamVideos',
      'Team / Raasta Page Videos',
      sumOf(creatorRows, (r) => r.teamVideos),
      targets.company.teamVideos,
    ),
  ];

  // Tracked but never targeted: call time and lead volume are running totals.
  const organicMinutes = sumOf(salesRows, (r) => r.organicCallMinutes);
  const marketingMinutes = sumOf(salesRows, (r) => r.marketingCallMinutes);
  const cumulative: StatRow[] = [
    stat('organicCallTime', 'Organic Call Time', organicMinutes, 'duration'),
    stat('reassignedCallTime', 'Reassigned Call Time', marketingMinutes, 'duration'),
    stat('totalCallTime', 'Total Call Time', organicMinutes + marketingMinutes, 'duration'),
    stat('leadsLogged', 'Leads Received', sumOf(salesRows, (r) => r.leadsReceived)),
    stat('selfCircle', 'Connected Self Circle', sumOf(salesRows, (r) => r.connectedSelfCircle)),
  ];

  let running = 0;
  const cumulativeSeries = dailyRevenueSeries.map((row) => {
    running += n(row.dailyRevenue);
    return { date: row.logDate, cumulative: running };
  });

  return {
    range,
    totals,
    cumulative,
    platforms: orderPlatforms(companyPlatforms),
    memberSummaries,
    cumulativeSeries,
    revenueActual,
    revenueTarget: targets.company.revenue,
  };
}

// ─── Notifications & audit ─────────────────────────────────────────────────────

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
