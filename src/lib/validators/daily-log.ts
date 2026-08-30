import { z } from 'zod';
import { VIRAL_PLATFORMS } from '@/db/schema';

const positiveInt = z.coerce.number().int().min(0);
const positiveDec = z.coerce.number().min(0);

// ─── Viral video row ────────────────────────────────────────────────────────
const viralPlatformRowSchema = z.object({
  platform: z.enum(VIRAL_PLATFORMS),
  count: z.coerce.number().int().min(1, 'Count must be at least 1'),
});

// ─── Lead distribution row ──────────────────────────────────────────────────

// ─── IG video row ───────────────────────────────────────────────────────────

// ─── Extra work row ─────────────────────────────────────────────────────────
const extraWorkRowSchema = z.object({
  workType: z.string().min(1).max(100),
  quantity: positiveInt.min(1),
  explanation: z.string().max(500).optional(),
  link: z.string().url().optional().or(z.literal('')),
});

// ─── Sales Agent daily log ──────────────────────────────────────────────────
export const salesLogSchema = z.object({
  memberId: z.string().min(1),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance: z.enum(['present', 'remote', 'hybrid', 'absent']),
  absenceNote: z.string().max(500).optional(),
  arrivalTiming: z
    .enum(['Before 9:00 AM', '9:00 AM – 9:59 AM', 'After 9:59 AM'])
    .optional(),
  lateReason: z.string().max(500).optional(),
  organicCalls: positiveInt,
  marketingCalls: positiveInt,
  // Call time in whole minutes, capped at a 24-hour day.
  organicCallMinutes: positiveInt.max(1440, 'Call time cannot exceed 24 hours'),
  marketingCallMinutes: positiveInt.max(1440, 'Call time cannot exceed 24 hours'),
  videoCalls: positiveInt,
  faceToFace: positiveInt,
  reelsUploaded: positiveInt,
  leadsReceived: positiveInt,
  salesRevenue: positiveDec,
  // Only LER/BDM submit this; the form hides it for plain Agents.
  teamRevenue: positiveDec.optional(),
  learnedToday: z.string().max(150).optional(),
  issuesToday: z.string().max(250).optional(),
  developerVisited: z.boolean(),
  developerNames: z.array(z.string().min(1).max(200)).optional(),
}).superRefine((data, ctx) => {
  if (data.arrivalTiming === 'After 9:59 AM' && !data.lateReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lateReason'],
      message: 'Late reason required when arriving after 9:59 AM',
    });
  }
  if (data.developerVisited && (!data.developerNames || data.developerNames.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['developerNames'],
      message: 'At least one developer / site name required',
    });
  }
});

// One block of daily numbers per agent on the creator's team.
export const creatorAgentMetricSchema = z
  .object({
    agentId: z.string().min(1, 'Agent required'),
    reelsGiven: positiveInt,
    leadsGenerated: positiveInt,
    picsGiven: positiveInt,
    // Viral videos are counted straight onto a platform, so the agent's viral
    // total for the day is the sum of these rows.
    viralPlatforms: z.array(viralPlatformRowSchema).default([]),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    for (const r of val.viralPlatforms) {
      if (seen.has(r.platform)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['viralPlatforms'],
          message: `${r.platform} is listed twice for the same agent`,
        });
        return;
      }
      seen.add(r.platform);
    }
  });

// ─── Content Creator daily log ───────────────────────────────────────────────
export const creatorLogSchema = z.object({
  memberId: z.string().min(1),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance: z.enum(['present', 'remote', 'hybrid', 'absent']),
  absenceNote: z.string().max(500).optional(),
  arrivalTiming: z
    .enum(['Before 9:00 AM', '9:00 AM – 9:59 AM', 'After 9:59 AM'])
    .optional(),
  lateReason: z.string().max(500).optional(),
  // Creator KPIs. Reels / Viral / Leads are logged per agent; the day's totals
  // are the sum of those rows. Team videos are the creator's own output.
  agentMetrics: z
    .array(creatorAgentMetricSchema)
    .min(1, 'Add at least one agent before submitting a log'),
  instagramVideos: positiveInt,
  remarks: z.string().max(500).optional(),
  // Sub-records
  shootParticipantIds: z.array(z.string()).optional(),
  extraWorkRows: z.array(extraWorkRowSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.arrivalTiming === 'After 9:59 AM' && !data.lateReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lateReason'],
      message: 'Late reason required when arriving after 9:59 AM',
    });
  }

  const seen = new Set<string>();
  for (const m of data.agentMetrics) {
    if (seen.has(m.agentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentMetrics'],
        message: 'The same agent appears twice',
      });
      break;
    }
    seen.add(m.agentId);
  }

  // Detail rows reconcile against the day's totals, summed across agents.
  const totalViral = data.agentMetrics.reduce(
    (s, m) => s + m.viralPlatforms.reduce((x, r) => x + r.count, 0),
    0,
  );

});

// ─── Correction request ──────────────────────────────────────────────────────
export const correctionRequestSchema = z.object({
  recordType: z.enum(['target', 'log']),
  recordId: z.coerce.number().int().positive(),
  memberId: z.string().min(1),
  proposedChanges: z.record(z.unknown()),
  originalValues: z.record(z.unknown()),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
});

export type SalesLogInput = z.infer<typeof salesLogSchema>;
export type CreatorLogInput = z.infer<typeof creatorLogSchema>;
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
