import { z } from 'zod';

export const addMemberSchema = z.object({
  fullName: z.string().min(2, 'Name required').max(200),
  categoryId: z.coerce.number().int().positive('Category required'),
  positionId: z.coerce.number().int().positive('Position required'),
  displayOrder: z.coerce.number().int().default(0),
});

export const updateMemberSchema = addMemberSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
