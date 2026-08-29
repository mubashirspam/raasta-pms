import { z } from 'zod';

export const addMemberSchema = z.object({
  fullName: z.string().min(2, 'Name required').max(200),
  memberCode: z
    .string()
    .min(2, 'Code required')
    .max(20)
    .regex(/^[A-Z0-9-]+$/i, 'Code: letters, numbers, hyphens only'),
  categoryId: z.coerce.number().int().positive('Category required'),
  positionId: z.coerce.number().int().positive('Position required'),
  teamName: z.string().max(100).optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  displayOrder: z.coerce.number().int().default(0),
});

export const updateMemberSchema = addMemberSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
