/**
 * Metric shapes and the rules for turning raw aggregates into rows.
 *
 * Pure and framework-free so both the admin analytics action and a member's own
 * home-screen summary build their rows here — one definition of what "Connected
 * Calls" means and which numbers carry a target.
 */
import type { DateRange } from './ranges';

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

/** Postgres returns sums as strings; nulls mean "nothing recorded". */
export const num = (v: unknown) => Number(v ?? 0);

export function metric(
  key: string,
  label: string,
  actual: number,
  target: number,
  format: MetricFormat = 'number',
): MetricRow {
  return { key, label, actual, target, format };
}

export function stat(
  key: string,
  label: string,
  value: number,
  format: StatRow['format'] = 'number',
): StatRow {
  return { key, label, value, format };
}

// ─── Targets ───────────────────────────────────────────────────────────────────

export interface TargetTotals {
  connectedCalls: number;
  videoCalls: number;
  faceToFace: number;
  revenue: number;
  reels: number;
  viral: number;
  leads: number;
  teamVideos: number;
}

export const emptyTargets = (): TargetTotals => ({
  connectedCalls: 0,
  videoCalls: 0,
  faceToFace: 0,
  revenue: 0,
  reels: 0,
  viral: 0,
  leads: 0,
  teamVideos: 0,
});

/** Adds one weekly target row into a running total, scaled by `factor`. */
export function accumulateTarget(
  into: TargetTotals,
  row: {
    connectedCallsTarget?: unknown;
    videoCallsTarget?: unknown;
    faceToFaceTarget?: unknown;
    revenueTarget?: unknown;
    reelsTarget?: unknown;
    viralVideosTarget?: unknown;
    leadsTarget?: unknown;
    teamVideosTarget?: unknown;
  },
  factor: number,
): void {
  into.connectedCalls += num(row.connectedCallsTarget) * factor;
  into.videoCalls += num(row.videoCallsTarget) * factor;
  into.faceToFace += num(row.faceToFaceTarget) * factor;
  into.revenue += num(row.revenueTarget) * factor;
  into.reels += num(row.reelsTarget) * factor;
  into.viral += num(row.viralVideosTarget) * factor;
  into.leads += num(row.leadsTarget) * factor;
  into.teamVideos += num(row.teamVideosTarget) * factor;
}

// ─── Row assembly ──────────────────────────────────────────────────────────────

export interface SalesAggregate {
  connectedCalls?: unknown;
  videoCalls?: unknown;
  faceToFace?: unknown;
  revenue?: unknown;
  leadsReceived?: unknown;
  organicCallMinutes?: unknown;
  marketingCallMinutes?: unknown;
}

export interface CreatorAggregate {
  reels?: unknown;
  viral?: unknown;
  leads?: unknown;
  teamVideos?: unknown;
}

export interface CreditedAggregate {
  reels?: unknown;
  viral?: unknown;
  leads?: unknown;
}

export interface MemberRowInput {
  kind: MemberKind;
  sales?: SalesAggregate | null;
  creator?: CreatorAggregate | null;
  /** What content creators delivered *for* this sales agent. */
  credited?: CreditedAggregate | null;
  viralTotal: number;
  ownTargets: TargetTotals;
  /** Targets creators committed to on this agent's behalf. */
  agentTargets: TargetTotals;
}

/**
 * The metric and cumulative rows for one person. Content creators are measured
 * on what they produced; everyone else on their own sales activity plus what
 * the creators carrying them delivered.
 */
export function buildMemberRows(input: MemberRowInput): {
  metrics: MetricRow[];
  cumulative: StatRow[];
} {
  const { kind, sales, creator, credited, viralTotal, ownTargets, agentTargets } = input;

  if (kind === 'creator') {
    return {
      metrics: [
        metric('reels', 'Reels Given', num(creator?.reels), ownTargets.reels),
        metric('viral', 'Viral Videos', viralTotal, ownTargets.viral),
        metric('leads', 'Leads Generated', num(creator?.leads), ownTargets.leads),
        metric('teamVideos', 'Team Videos', num(creator?.teamVideos), ownTargets.teamVideos),
      ],
      cumulative: [],
    };
  }

  const organicMins = num(sales?.organicCallMinutes);
  const marketingMins = num(sales?.marketingCallMinutes);

  return {
    metrics: [
      metric('connectedCalls', 'Connected Calls', num(sales?.connectedCalls), ownTargets.connectedCalls),
      metric('videoCalls', 'Video Calls', num(sales?.videoCalls), ownTargets.videoCalls),
      metric('faceToFace', 'Face-to-Face', num(sales?.faceToFace), ownTargets.faceToFace),
      metric('revenue', 'Revenue', num(sales?.revenue), ownTargets.revenue, 'currency'),
      // Delivered by the content creators who carry this agent on their team.
      metric('reelsReceived', 'Reels From Creators', num(credited?.reels), agentTargets.reels),
      metric('viralReceived', 'Viral Videos', viralTotal, agentTargets.viral),
      metric('leadsReceived', 'Leads From Creators', num(credited?.leads), agentTargets.leads),
    ],
    cumulative: [
      stat('organicCallTime', 'Organic Call Time', organicMins, 'duration'),
      stat('reassignedCallTime', 'Reassigned Call Time', marketingMins, 'duration'),
      stat('totalCallTime', 'Total Call Time', organicMins + marketingMins, 'duration'),
      stat('leadsLogged', 'Leads Received', num(sales?.leadsReceived)),
    ],
  };
}
