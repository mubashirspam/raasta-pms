'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  weeklyTargets,
  teamRevenueTargets,
  teamMembers,
  positions,
  notifications,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { salesTargetSchema, creatorTargetSchema } from '@/lib/validators/targets';
import { generateRef } from '@/lib/domain/helpers';

export async function submitSalesTarget(
  raw: unknown,
): Promise<{ success: boolean; error?: string; referenceNumber?: string }> {
  const parsed = salesTargetSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;

  // Check for duplicate target submission
  const existing = await db.query.weeklyTargets.findFirst({
    where: and(
      eq(weeklyTargets.memberId, data.memberId),
      eq(weeklyTargets.weekId, data.weekId),
    ),
  });

  if (existing) {
    return {
      success: false,
      error: 'You have already submitted a target for this week. Use the correction workflow to make changes.',
    };
  }

  // Position flag check: compare submitted position vs member's recorded position
  const member = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, data.memberId),
  });

  const positionFlagged = member?.positionId !== data.positionId;
  const referenceNumber = generateRef('TGT');

  const [target] = await db
    .insert(weeklyTargets)
    .values({
      memberId: data.memberId,
      weekId: data.weekId,
      positionId: data.positionId,
      positionFlagged,
      connectedCallsTarget: data.connectedCallsTarget,
      videoCallsTarget: data.videoCallsTarget,
      faceToFaceTarget: data.faceToFaceTarget,
      revenueTarget: String(data.revenueTarget),
      developerVisitsTarget: data.developerVisitsTarget,
      referenceNumber,
    })
    .returning();

  // Handle LER/BDM team revenue target
  if (data.teamRevenueAmount && data.teamRevenueAmount > 0) {
    const { month, year } = await getMonthYearForWeek(data.weekId);
    await db
      .insert(teamRevenueTargets)
      .values({
        memberId: data.memberId,
        month,
        year,
        amount: String(data.teamRevenueAmount),
        proposedBy: data.memberId,
      })
      .onConflictDoNothing();
  }

  // Notify admin if position flagged
  if (positionFlagged) {
    await db.insert(notifications).values({
      type: 'position_flag',
      title: 'Position mismatch flagged',
      body: `${member?.fullName ?? data.memberId} submitted target with a different position.`,
      memberId: data.memberId,
    });
  }

  // Update member last submission timestamp
  await db
    .update(teamMembers)
    .set({ lastSubmissionAt: new Date() })
    .where(eq(teamMembers.id, data.memberId));

  revalidatePath('/analytics');

  return { success: true, referenceNumber };
}

export async function submitCreatorTarget(
  raw: unknown,
): Promise<{ success: boolean; error?: string; referenceNumber?: string }> {
  const parsed = creatorTargetSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;

  const existing = await db.query.weeklyTargets.findFirst({
    where: and(
      eq(weeklyTargets.memberId, data.memberId),
      eq(weeklyTargets.weekId, data.weekId),
    ),
  });

  if (existing) {
    return {
      success: false,
      error: 'Target already submitted for this week.',
    };
  }

  const referenceNumber = generateRef('TGT');

  await db.insert(weeklyTargets).values({
    memberId: data.memberId,
    weekId: data.weekId,
    reelsTarget: data.reelsTarget,
    viralVideosTarget: data.viralVideosTarget,
    leadsTarget: data.leadsTarget,
    instagramVideosTarget: data.instagramVideosTarget,
    referenceNumber,
  });

  await db
    .update(teamMembers)
    .set({ lastSubmissionAt: new Date() })
    .where(eq(teamMembers.id, data.memberId));

  revalidatePath('/analytics');

  return { success: true, referenceNumber };
}

export async function getTargetsForMember(memberId: string) {
  return db.query.weeklyTargets.findMany({
    where: eq(weeklyTargets.memberId, memberId),
    with: { week: true },
    orderBy: (t, { desc }) => [desc(t.submittedAt)],
  });
}

// Helper: get month/year for a week — used for team revenue targets
async function getMonthYearForWeek(
  weekId: number,
): Promise<{ month: number; year: number }> {
  const week = await db.query.operationalWeeks.findFirst({
    where: (t) => eq(t.id, weekId),
  });
  return { month: week?.month ?? new Date().getMonth() + 1, year: week?.year ?? new Date().getFullYear() };
}
