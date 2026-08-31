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
  daysRemote: number;
  daysAbsent: number;
  /**
   * The other side of the creator↔agent roster: for a content creator these are
   * the sales agents they carry; for a sales agent, the creators carrying them.
   */
  connections: MemberLink[];
  /** Set only for an LER/BDM; see TeamRevenue. */
  teamRevenue: TeamRevenue | null;
}

/**
 * An LER/BDM's team revenue, summed from the agents holding that leader's
 * position ("Ramesh-LER"). Nobody types this in — it is derived, so it cannot
 * drift from what the team actually logged. Null for everyone but a leader.
 */
export interface TeamRevenue {
  total: number;
  /** Who contributed, so the total can be read back to its parts. */
  members: Array<{
    memberId: string;
    fullName: string;
    memberCode: string;
    revenue: number;
  }>;
}

/** A person on the other end of a creator/agent link. */
export interface MemberLink {
  memberId: string;
  fullName: string;
  memberCode: string;
  positionName: string;
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
  reelsUploaded: number;
  selfieVideos: number;
  reels: number;
  viral: number;
  leads: number;
  pics: number;
  longForm: number;
  teamVideos: number;
}

export const emptyTargets = (): TargetTotals => ({
  connectedCalls: 0,
  videoCalls: 0,
  faceToFace: 0,
  revenue: 0,
  reelsUploaded: 0,
  selfieVideos: 0,
  reels: 0,
  viral: 0,
  leads: 0,
  pics: 0,
  longForm: 0,
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
    reelsUploadedTarget?: unknown;
    selfieVideosTarget?: unknown;
    reelsTarget?: unknown;
    viralVideosTarget?: unknown;
    leadsTarget?: unknown;
    picsTarget?: unknown;
    longFormTarget?: unknown;
    teamVideosTarget?: unknown;
  },
  factor: number,
): void {
  into.connectedCalls += num(row.connectedCallsTarget) * factor;
  into.videoCalls += num(row.videoCallsTarget) * factor;
  into.faceToFace += num(row.faceToFaceTarget) * factor;
  into.revenue += num(row.revenueTarget) * factor;
  into.reelsUploaded += num(row.reelsUploadedTarget) * factor;
  into.selfieVideos += num(row.selfieVideosTarget) * factor;
  into.reels += num(row.reelsTarget) * factor;
  into.viral += num(row.viralVideosTarget) * factor;
  into.leads += num(row.leadsTarget) * factor;
  into.pics += num(row.picsTarget) * factor;
  into.longForm += num(row.longFormTarget) * factor;
  into.teamVideos += num(row.teamVideosTarget) * factor;
}

// ─── Row assembly ──────────────────────────────────────────────────────────────

export interface SalesAggregate {
  connectedCalls?: unknown;
  connectedSelfCircle?: unknown;
  videoCalls?: unknown;
  faceToFace?: unknown;
  revenue?: unknown;
  reelsUploaded?: unknown;
  selfieVideos?: unknown;
  leadsReceived?: unknown;
  organicCallMinutes?: unknown;
  marketingCallMinutes?: unknown;
}

export interface CreatorAggregate {
  reels?: unknown;
  viral?: unknown;
  leads?: unknown;
  pics?: unknown;
  longForm?: unknown;
  teamVideos?: unknown;
}

export interface CreditedAggregate {
  reels?: unknown;
  viral?: unknown;
  leads?: unknown;
  pics?: unknown;
  longForm?: unknown;
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
        metric('viral', 'Viral Videos (100K+ Views)', viralTotal, ownTargets.viral),
        metric('leads', 'Leads Generated', num(creator?.leads), ownTargets.leads),
        metric('pics', 'Pics / Carousel / Poster', num(creator?.pics), ownTargets.pics),
        metric('longForm', 'Long Form Videos', num(creator?.longForm), ownTargets.longForm),
        metric(
          'teamVideos',
          'Team / Raasta Page Videos',
          num(creator?.teamVideos),
          ownTargets.teamVideos,
        ),
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
      // The agent's own uploads, straight off their daily log.
      metric('reelsUploaded', 'Reels Uploaded', num(sales?.reelsUploaded), ownTargets.reelsUploaded),
      metric('selfieVideos', 'Selfie Videos', num(sales?.selfieVideos), ownTargets.selfieVideos),
      // Delivered by the content creators who carry this agent on their team.
      metric('reelsReceived', 'Reels From Creators', num(credited?.reels), agentTargets.reels),
      metric('viralReceived', 'Viral Videos (100K+ Views)', viralTotal, agentTargets.viral),
      metric('leadsReceived', 'Leads From Creators', num(credited?.leads), agentTargets.leads),
      metric('pics', 'Pics / Carousel / Poster', num(credited?.pics), agentTargets.pics),
      metric('longForm', 'Long Form Videos', num(credited?.longForm), agentTargets.longForm),
    ],
    cumulative: [
      stat('organicCallTime', 'Organic Call Time', organicMins, 'duration'),
      stat('reassignedCallTime', 'Reassigned Call Time', marketingMins, 'duration'),
      stat('totalCallTime', 'Total Call Time', organicMins + marketingMins, 'duration'),
      stat('leadsLogged', 'Leads Received', num(sales?.leadsReceived)),
      stat('selfCircle', 'Connected Self Circle', num(sales?.connectedSelfCircle)),
    ],
  };
}
