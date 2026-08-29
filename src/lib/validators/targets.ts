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
  developerVisitsTarget: positiveInt,
  // LER/BDM optional team revenue
  teamRevenueAmount: positiveDec.optional(),
});

export const creatorTargetSchema = z.object({
  memberId: z.string().min(1, 'Member required'),
  weekId: z.coerce.number().int().positive('Week required'),
  reelsTarget: positiveInt,
  viralVideosTarget: positiveInt,
  leadsTarget: positiveInt,
  instagramVideosTarget: positiveInt,
});

export type SalesTargetInput = z.infer<typeof salesTargetSchema>;
export type CreatorTargetInput = z.infer<typeof creatorTargetSchema>;
