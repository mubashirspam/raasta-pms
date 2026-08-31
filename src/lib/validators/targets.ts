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
  // LER/BDM optional team revenue
  teamRevenueAmount: positiveDec.optional(),
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
