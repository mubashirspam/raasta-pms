'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  teamMembers,
  dailyLogs,
  weeklyTargets,
} from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { addMemberSchema, updateMemberSchema } from '@/lib/validators/members';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { writeAudit } from '@/lib/auth';
import { nanoid } from 'nanoid';

export async function getMembers(filters?: {
  categoryId?: number;
  isActive?: boolean;
}) {
  const conditions = [];
  if (filters?.categoryId) conditions.push(eq(teamMembers.categoryId, filters.categoryId));
  if (filters?.isActive !== undefined) conditions.push(eq(teamMembers.isActive, filters.isActive));

  return db.query.teamMembers.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      category: true,
      position: true,
    },
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.fullName)],
  });
}

export async function addMember(
  raw: unknown,
): Promise<{ success: boolean; error?: string; id?: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  const parsed = addMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;
  const id = nanoid(12);

  // Check for duplicate member code
  const existing = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.memberCode, data.memberCode.toUpperCase()),
  });
  if (existing) {
    return { success: false, error: `Member code "${data.memberCode}" already in use` };
  }

  await db.insert(teamMembers).values({
    id,
    fullName: data.fullName,
    memberCode: data.memberCode.toUpperCase(),
    categoryId: data.categoryId,
    positionId: data.positionId,
    teamName: data.teamName,
    joiningDate: data.joiningDate,
    displayOrder: data.displayOrder,
  });

  await writeAudit('CREATE_MEMBER', 'team_member', id, { fullName: data.fullName });
  revalidatePath('/manage-team');
  revalidatePath('/targets');
  revalidatePath('/daily-log');

  return { success: true, id };
}

export async function updateMember(
  memberId: string,
  raw: unknown,
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  const parsed = updateMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;

  await db
    .update(teamMembers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teamMembers.id, memberId));

  await writeAudit('UPDATE_MEMBER', 'team_member', memberId, data);
  revalidatePath('/manage-team');
  revalidatePath('/targets');
  revalidatePath('/daily-log');

  return { success: true };
}

export async function deleteMember(
  memberId: string,
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  // Safe delete check — member with historical data cannot be deleted
  const [logCount] = await db
    .select({ count: count() })
    .from(dailyLogs)
    .where(eq(dailyLogs.memberId, memberId));

  const [targetCount] = await db
    .select({ count: count() })
    .from(weeklyTargets)
    .where(eq(weeklyTargets.memberId, memberId));

  const hasData =
    (logCount?.count ?? 0) > 0 || (targetCount?.count ?? 0) > 0;

  if (hasData) {
    // Deactivate instead of delete
    await db
      .update(teamMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(teamMembers.id, memberId));

    await writeAudit('DEACTIVATE_MEMBER', 'team_member', memberId, {
      reason: 'Has historical data — deactivated instead of deleted',
    });

    return {
      success: true,
      error: 'Member has historical data — deactivated instead of permanently deleted.',
    };
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
  await writeAudit('DELETE_MEMBER', 'team_member', memberId, {});
  revalidatePath('/manage-team');

  return { success: true };
}
