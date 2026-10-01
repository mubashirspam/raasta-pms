/**
 * The monthly target: which numbers a member commits to for the month, and how
 * they are scored. Shared by the form, the validator, the member's home screen
 * and admin analytics so all four agree on the list.
 *
 * A monthly target is scored against everything logged in the calendar month,
 * so a week that fell short can be made up by a stronger one later.
 */
import {
  buildMemberRows,
  emptyTargets,
  accumulateTarget,
  type MemberKind,
  type MemberRowInput,
  type MetricRow,
} from './metrics';

export interface MonthlyField {
  /** Column on monthly_targets. */
  key: string;
  label: string;
  /** The analytics metric this target is scored against. */
  metricKey: string;
  format: 'number' | 'currency';
}

export const SALES_MONTHLY_FIELDS: MonthlyField[] = [
  { key: 'connectedCallsTarget', label: 'Connected Calls', metricKey: 'connectedCalls', format: 'number' },
  { key: 'videoCallsTarget', label: 'Video Calls', metricKey: 'videoCalls', format: 'number' },
  { key: 'faceToFaceTarget', label: 'Face-to-Face', metricKey: 'faceToFace', format: 'number' },
  { key: 'revenueTarget', label: 'Revenue (AED)', metricKey: 'revenue', format: 'currency' },
  { key: 'reelsUploadedTarget', label: 'Reels Uploaded', metricKey: 'reelsUploaded', format: 'number' },
  { key: 'selfieVideosTarget', label: 'Selfie Videos', metricKey: 'selfieVideos', format: 'number' },
];

// A creator's weekly targets are split per agent; the monthly one is a single
// total across the whole team, matching the creator's own analytics rows.
export const CREATOR_MONTHLY_FIELDS: MonthlyField[] = [
  { key: 'reelsTarget', label: 'Reels Given', metricKey: 'reels', format: 'number' },
  { key: 'viralVideosTarget', label: 'Viral Videos (100K+ Views)', metricKey: 'viral', format: 'number' },
  { key: 'leadsTarget', label: 'Leads Generated', metricKey: 'leads', format: 'number' },
  { key: 'picsTarget', label: 'Pics / Carousel / Poster', metricKey: 'pics', format: 'number' },
  { key: 'longFormTarget', label: 'Long Form Videos', metricKey: 'longForm', format: 'number' },
  { key: 'teamVideosTarget', label: 'Team / Raasta Page Videos', metricKey: 'teamVideos', format: 'number' },
];

export function monthlyFieldsFor(kind: MemberKind): MonthlyField[] {
  return kind === 'creator' ? CREATOR_MONTHLY_FIELDS : SALES_MONTHLY_FIELDS;
}

/**
 * Month actuals against the monthly target, one row per monthly field. Built
 * through the same row builder as weekly analytics so "Connected Calls" counts
 * the same thing in both. Pass the month's actuals; null target → null rows.
 */
export function buildMonthlyRows(
  input: Omit<MemberRowInput, 'ownTargets' | 'agentTargets'>,
  target: Parameters<typeof accumulateTarget>[1] | null | undefined,
): MetricRow[] | null {
  if (!target) return null;
  const totals = emptyTargets();
  accumulateTarget(totals, target, 1);

  const { metrics } = buildMemberRows({ ...input, ownTargets: totals, agentTargets: emptyTargets() });
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  return monthlyFieldsFor(input.kind)
    .map((f) => byKey.get(f.metricKey))
    .filter((m): m is MetricRow => !!m);
}
