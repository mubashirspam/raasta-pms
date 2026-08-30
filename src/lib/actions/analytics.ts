'use server';

import { db } from '@/db';
import {
  dailyLogs,
  weeklyTargets,
  teamMembers,
  operationalWeeks,
  creatorDailyMetrics,
  creatorAgentDailyMetrics,
  viralPlatformCounts,
  notifications,
  auditLog,
  VIRAL_PLATFORMS,
} from '@/db/schema';
import { eq, and, gte, lte, sum, count, sql } from 'drizzle-orm';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { weekOverlapFactor, type DateRange } from '@/lib/domain/ranges';

// ─── Shapes ────────────────────────────────────────────────────────────────────

export type MetricFormat = 'number' | 'currency';

export interface MetricRow {
  key: string;
  label: string;
  actual: number;
  /** Prorated target for the range. 0 means "no target was set". */
  target: number;
  format: MetricFormat;
}

export interface PlatformCount {
  platform: string;
  count: number;
}

/**
 * A running total with no target behind it — call time and lead volume are
 * tracked but never committed to in the weekly target form.
 */
export interface StatRow {
  key: string;
  label: string;
  value: number;
  format: 'number' | 'duration';
}

export type MemberKind = 'sales' | 'creator' | 'other';

export interface MemberAnalytics {
  memberId: string;
  fullName: string;
  memberCode: string;
  categoryName: string;
  positionName: string;
  kind: MemberKind;
  metrics: MetricRow[];
  cumulative: StatRow[];
  /** Viral videos this person produced (creator) or was credited with (agent). */
  platforms: PlatformCount[];
  viralTotal: number;
  logsSubmitted: number;
  daysPresent: number;
  daysAbsent: number;
}

export interface RangeAnalytics {
  range: DateRange;
  totals: MetricRow[];
  cumulative: StatRow[];
  platforms: PlatformCount[];
  memberSummaries: MemberAnalytics[];
  cumulativeSeries: Array<{ date: string; cumulative: number }>;
  revenueActual: number;
  revenueTarget: number;
}

const n = (v: unknown) => Number(v ?? 0);

function metric(
  key: string,
  label: string,
  actual: number,
  target: number,
  format: MetricFormat = 'number',
): MetricRow {
  return { key, label, actual, target, format };
}

function stat(
  key: string,
  label: string,
  value: number,
  format: StatRow['format'] = 'number',
): StatRow {
  return { key, label, value, format };
}

// ─── Prorated targets ──────────────────────────────────────────────────────────

interface TargetTotals {
  connectedCalls: number;
  videoCalls: number;
  faceToFace: number;
  revenue: number;
  reels: number;
  viral: number;
  leads: number;
  teamVideos: number;
}

const emptyTargets = (): TargetTotals => ({
  connectedCalls: 0,
  videoCalls: 0,
  faceToFace: 0,
  revenue: 0,
  reels: 0,
  viral: 0,
  leads: 0,
  teamVideos: 0,
});

/**
 * Weekly targets that overlap the range, each scaled to the share of its Mon–Sat
 * week that actually falls inside it. Returns targets keyed two ways:
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

  const byOwner = new Map<string, TargetTotals>();
  const byAgent = new Map<string, TargetTotals>();
  const company = emptyTargets();

  for (const r of rows) {
    const f = weekOverlapFactor(r.startDate, r.endDate, range);
    if (f <= 0) continue;

    const owner = byOwner.get(r.memberId) ?? emptyTargets();

    owner.connectedCalls += n(r.connectedCallsTarget) * f;
    owner.videoCalls += n(r.videoCallsTarget) * f;
    owner.faceToFace += n(r.faceToFaceTarget) * f;
    owner.revenue += n(r.revenueTarget) * f;
    owner.reels += n(r.reelsTarget) * f;
    owner.viral += n(r.viralVideosTarget) * f;
    owner.leads += n(r.leadsTarget) * f;
    owner.teamVideos += n(r.teamVideosTarget) * f;
    byOwner.set(r.memberId, owner);

    company.connectedCalls += n(r.connectedCallsTarget) * f;
    company.videoCalls += n(r.videoCallsTarget) * f;
    company.faceToFace += n(r.faceToFaceTarget) * f;
    company.revenue += n(r.revenueTarget) * f;
    company.reels += n(r.reelsTarget) * f;
    company.viral += n(r.viralVideosTarget) * f;
    company.leads += n(r.leadsTarget) * f;
    company.teamVideos += n(r.teamVideosTarget) * f;

    // Creator rows carry an agentId: that agent is the one being delivered for.
    if (r.agentId) {
      const agent = byAgent.get(r.agentId) ?? emptyTargets();
      agent.reels += n(r.reelsTarget) * f;
      agent.viral += n(r.viralVideosTarget) * f;
      agent.leads += n(r.leadsTarget) * f;
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

    collectTargets(range),
  ]);

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

    const metrics: MetricRow[] = [];
    const cumulative: StatRow[] = [];
    let platforms: PlatformCount[];
    let viralTotal: number;

    if (kind === 'creator') {
      platforms = orderPlatforms(platformsByCreator.get(m.id));
      viralTotal = platforms.reduce((a, p) => a + p.count, 0);
      metrics.push(
        metric('reels', 'Reels Given', n(c?.reels), ownTargets.reels),
        metric('viral', 'Viral Videos', viralTotal, ownTargets.viral),
        metric('leads', 'Leads Generated', n(c?.leads), ownTargets.leads),
        metric('teamVideos', 'Team / Raasta Videos', n(c?.teamVideos), ownTargets.teamVideos),
      );
    } else {
      platforms = orderPlatforms(platformsByAgent.get(m.id));
      viralTotal = platforms.reduce((a, p) => a + p.count, 0);
      metrics.push(
        metric('connectedCalls', 'Connected Calls', n(s?.connectedCalls), ownTargets.connectedCalls),
        metric('videoCalls', 'Video Calls', n(s?.videoCalls), ownTargets.videoCalls),
        metric('faceToFace', 'Face-to-Face', n(s?.faceToFace), ownTargets.faceToFace),
        metric('revenue', 'Revenue', n(s?.revenue), ownTargets.revenue, 'currency'),
        // Delivered by the content creators who carry this agent on their team.
        metric('reelsReceived', 'Reels From Creators', n(credited?.reels), agentTargets.reels),
        metric('viralReceived', 'Viral Videos', viralTotal, agentTargets.viral),
        metric('leadsReceived', 'Leads From Creators', n(credited?.leads), agentTargets.leads),
      );

      const organicMins = n(s?.organicCallMinutes);
      const marketingMins = n(s?.marketingCallMinutes);
      cumulative.push(
        stat('organicCallTime', 'Organic Call Time', organicMins, 'duration'),
        stat('reassignedCallTime', 'Reassigned Call Time', marketingMins, 'duration'),
        stat('totalCallTime', 'Total Call Time', organicMins + marketingMins, 'duration'),
        stat('leadsLogged', 'Leads Received', n(s?.leadsReceived)),
      );
    }

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
      daysAbsent: n(s?.absent),
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
    metric('viral', 'Viral Videos', companyViral, targets.company.viral),
    metric('leads', 'Leads Generated', sumOf(creatorRows, (r) => r.leads), targets.company.leads),
    metric(
      'teamVideos',
      'Team / Raasta Videos',
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
