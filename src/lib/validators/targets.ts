import { z } from 'zod';

const positiveInt = z.coerce.number().int().min(0);
const positiveDec = z.coerce.number().min(0);

export const salesTargetSchema = z.object({
  memberId: z.string().min(1, 'Member required'),
  weekId: z.coerce.number().int().positive('Week required'),
  positionId: z.coerce.number().int().positive('Position required'),
  connectedCallsTarget: positiveInt,
  videoCallsTarget: positiveInt,
  faceToFaceTarget: positiveInt,
  revenueTarget: positiveDec,
  reelsUploadedTarget: positiveInt,
  selfieVideosTarget: positiveInt,
});

// One block of numbers per agent on the creator's team.
export const creatorAgentTargetSchema = z.object({
  agentId: z.string().min(1, 'Agent required'),
  reelsTarget: positiveInt,
  viralVideosTarget: positiveInt,
  leadsTarget: positiveInt,
  picsTarget: positiveInt,
  longFormTarget: positiveInt,
});

export const creatorTargetSchema = z
  .object({
    memberId: z.string().min(1, 'Member required'),
    weekId: z.coerce.number().int().positive('Week required'),
    // Team / Raasta page videos are the creator's own output, not tied to an agent.
    teamVideosTarget: positiveInt,
    agentTargets: z
      .array(creatorAgentTargetSchema)
      .min(1, 'Add at least one agent before submitting a target'),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    for (const t of val.agentTargets) {
      if (seen.has(t.agentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The same agent appears twice',
          path: ['agentTargets'],
        });
        return;
      }
      seen.add(t.agentId);
    }
  });

export const creatorTeamAgentSchema = z.object({
  creatorId: z.string().min(1, 'Creator required'),
  agentId: z.string().min(1, 'Agent required'),
});

export type SalesTargetInput = z.infer<typeof salesTargetSchema>;
export type CreatorTargetInput = z.infer<typeof creatorTargetSchema>;
export type CreatorAgentTargetInput = z.infer<typeof creatorAgentTargetSchema>;
export type CreatorTeamAgentInput = z.infer<typeof creatorTeamAgentSchema>;

// ─── Admin target edits ────────────────────────────────────────────────────────
// A submitted target is locked to the member who set it; only an admin can
// change it afterwards. Bounded here so a stray keystroke cannot write a
// target that skews every achievement percentage that reads it.
const MAX_COUNT = 100_000;
const MAX_REVENUE = 1_000_000_000;

const boundedInt = z.coerce
  .number({ invalid_type_error: 'Enter a number' })
  .int('Whole numbers only')
  .min(0, 'Cannot be negative')
  .max(MAX_COUNT, `Cannot exceed ${MAX_COUNT.toLocaleString()}`);

const boundedDec = z.coerce
  .number({ invalid_type_error: 'Enter a number' })
  .min(0, 'Cannot be negative')
  .max(MAX_REVENUE, 'Revenue target is unrealistically large');

// Why the admin overrode the member's number. Optional, but it is what the
// member sees in their notification, so it is worth asking for.
const editReason = z
  .string()
  .trim()
  .max(250, 'Keep the reason under 250 characters')
  .optional()
  .transform((v) => (v ? v : undefined));

export const adminSalesTargetEditSchema = z.object({
  targetId: z.coerce.number().int().positive('Target required'),
  reason: editReason,
  connectedCallsTarget: boundedInt,
  videoCallsTarget: boundedInt,
  faceToFaceTarget: boundedInt,
  revenueTarget: boundedDec,
  reelsUploadedTarget: boundedInt,
  selfieVideosTarget: boundedInt,
});

export const adminCreatorAgentTargetEditSchema = z.object({
  targetId: z.coerce.number().int().positive('Target required'),
  reelsTarget: boundedInt,
  viralVideosTarget: boundedInt,
  leadsTarget: boundedInt,
  picsTarget: boundedInt,
  longFormTarget: boundedInt,
});

export const adminCreatorTargetEditSchema = z
  .object({
    memberId: z.string().min(1, 'Member required'),
    weekId: z.coerce.number().int().positive('Week required'),
    reason: editReason,
    // The creator-level row (agent_id null) carries the team-video target.
    // Older weeks were submitted without one, so it may legitimately be absent.
    creatorRow: z
      .object({
        targetId: z.coerce.number().int().positive('Target required'),
        teamVideosTarget: boundedInt,
      })
      .nullable(),
    agentRows: z.array(adminCreatorAgentTargetEditSchema),
  })
  .superRefine((val, ctx) => {
    if (!val.creatorRow && val.agentRows.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nothing to update for this week',
      });
      return;
    }
    const seen = new Set<number>();
    for (const row of [
      ...(val.creatorRow ? [val.creatorRow.targetId] : []),
      ...val.agentRows.map((r) => r.targetId),
    ]) {
      if (seen.has(row)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The same target row appears twice',
          path: ['agentRows'],
        });
        return;
      }
      seen.add(row);
    }
  });

export type AdminSalesTargetEditInput = z.infer<typeof adminSalesTargetEditSchema>;
export type AdminCreatorTargetEditInput = z.infer<typeof adminCreatorTargetEditSchema>;
