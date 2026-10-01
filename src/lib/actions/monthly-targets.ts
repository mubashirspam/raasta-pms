'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { monthlyTargets, teamMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentMember } from '@/lib/auth-server';
import {
  salesMonthlyTargetSchema,
  creatorMonthlyTargetSchema,
} from '@/lib/validators/targets';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { generateRef } from '@/lib/domain/helpers';

/** The signed-in member's target for the current month, or null if not set. */
export async function getMyMonthlyTarget() {
  const ctx = await getCurrentMember();
  if (!ctx) return null;
  const { month, year } = currentMonthYearDubai();

  const row = await db.query.monthlyTargets.findFirst({
    where: and(
      eq(monthlyTargets.memberId, ctx.member.id),
      eq(monthlyTargets.month, month),
      eq(monthlyTargets.year, year),
    ),
  });
  return row ?? null;
}

/**
 * Sets the signed-in member's target for the current month. The member comes
 * from the session and the month from the Dubai clock, so neither can be
 * pointed elsewhere. Locked once submitted, like a weekly target.
 */
export async function submitMonthlyTarget(
  raw: unknown,
): Promise<{ success: boolean; error?: string; referenceNumber?: string }> {
  const ctx = await getCurrentMember();
  if (!ctx) return { success: false, error: 'Not authenticated' };

  const isCreator = ctx.member.category.name === 'Content Creator';
  const parsed = (isCreator ? creatorMonthlyTargetSchema : salesMonthlyTargetSchema).safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const { month, year } = currentMonthYearDubai();
  const data = parsed.data as Record<string, number>;
  const referenceNumber = generateRef('MTG');

  const values = {
    memberId: ctx.member.id,
    month,
    year,
    referenceNumber,
    ...data,
    ...('revenueTarget' in data ? { revenueTarget: String(data.revenueTarget) } : {}),
  };

  // The unique index settles a double submit: the second insert does nothing.
  const inserted = await db
    .insert(monthlyTargets)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: monthlyTargets.id });

  if (inserted.length === 0) {
    return {
      success: false,
      error: 'You have already set a target for this month. Ask your admin if it needs correcting.',
    };
  }

  await db
    .update(teamMembers)
    .set({ lastSubmissionAt: new Date() })
    .where(eq(teamMembers.id, ctx.member.id));

  revalidatePath('/targets');
  revalidatePath('/home');
  revalidatePath('/analytics');

  return { success: true, referenceNumber };
}
