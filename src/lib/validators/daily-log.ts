import { z } from 'zod';

const positiveInt = z.coerce.number().int().min(0);
const positiveDec = z.coerce.number().min(0);

// ─── Viral video row ────────────────────────────────────────────────────────
const viralVideoRowSchema = z.object({
  title: z.string().min(1, 'Title required').max(300),
  contentOwnerId: z.string().optional(),
  platform: z.string().max(50).optional(),
  videoUrl: z.string().url('Valid URL required'),
  contentId: z.string().max(200).optional(),
  crossed100kAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  currentViews: positiveInt,
});

// ─── Lead distribution row ──────────────────────────────────────────────────
const leadDistRowSchema = z.object({
  recipientId: z.string().optional().nullable(),
  recipientLabel: z.string().max(200).optional(),
  leadsCount: z.coerce.number().int().min(1, 'Must be ≥ 1'),
  note: z.string().max(500).optional(),
});

// ─── IG video row ───────────────────────────────────────────────────────────
const igVideoRowSchema = z.object({
  title: z.string().min(1).max(300),
  status: z.string().min(1, 'Status required'),
  platform: z.string().max(50).optional(),
  link: z.string().url().optional().or(z.literal('')),
  contentRef: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});

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
  attendance: z.enum(['present', 'absent', 'wfh', 'sick']),
  absenceNote: z.string().max(500).optional(),
  arrivalTiming: z
    .enum(['Before 9:00 AM', '9:00 AM – 9:59 AM', 'After 9:59 AM'])
    .optional(),
  lateReason: z.string().max(500).optional(),
  organicCalls: positiveInt,
  marketingCalls: positiveInt,
  videoCalls: positiveInt,
  faceToFace: positiveInt,
  reelsUploaded: positiveInt,
  leadsReceived: positiveInt,
  salesRevenue: positiveDec,
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
      message: 'At least one developer name required',
    });
  }
});

// ─── Content Creator daily log ───────────────────────────────────────────────
export const creatorLogSchema = z.object({
  memberId: z.string().min(1),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance: z.enum(['present', 'absent', 'wfh', 'sick']),
  absenceNote: z.string().max(500).optional(),
  arrivalTiming: z
    .enum(['Before 9:00 AM', '9:00 AM – 9:59 AM', 'After 9:59 AM'])
    .optional(),
  lateReason: z.string().max(500).optional(),
  // Creator KPIs
  reelsGiven: positiveInt,
  viralVideos: positiveInt,
  leadsGenerated: positiveInt,
  instagramVideos: positiveInt,
  remarks: z.string().max(500).optional(),
  // Sub-records
  shootParticipantIds: z.array(z.string()).optional(),
  viralVideoRows: z.array(viralVideoRowSchema).optional(),
  leadDistRows: z.array(leadDistRowSchema).optional(),
  igVideoRows: z.array(igVideoRowSchema).optional(),
  extraWorkRows: z.array(extraWorkRowSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.arrivalTiming === 'After 9:59 AM' && !data.lateReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lateReason'],
      message: 'Late reason required when arriving after 9:59 AM',
    });
  }
  if (data.viralVideos > 0 && (!data.viralVideoRows || data.viralVideoRows.length !== data.viralVideos)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['viralVideoRows'],
      message: `Provide exactly ${data.viralVideos} viral video detail row(s)`,
    });
  }
  if (data.instagramVideos > 0 && (!data.igVideoRows || data.igVideoRows.length !== data.instagramVideos)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['igVideoRows'],
      message: `Provide exactly ${data.instagramVideos} IG video detail row(s)`,
    });
  }
  // Lead reconciliation
  if (data.leadsGenerated > 0 && data.leadDistRows && data.leadDistRows.length > 0) {
    const total = data.leadDistRows.reduce((s, r) => s + (r.leadsCount || 0), 0);
    if (total !== data.leadsGenerated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['leadDistRows'],
        message: `Lead distribution total (${total}) must equal leads generated (${data.leadsGenerated})`,
      });
    }
  }
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
