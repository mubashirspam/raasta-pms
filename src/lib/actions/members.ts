'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  teamMembers,
  dailyLogs,
  weeklyTargets,
  appUsers,
} from '@/db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { addMemberSchema, updateMemberSchema } from '@/lib/validators/members';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { writeAudit, createUserForMember, regeneratePin } from '@/lib/auth';
import { syncLeaderPosition } from '@/lib/leader-positions';
import { nanoid } from 'nanoid';

/** Members with their login credentials. Admin-only — PINs are readable here. */
export async function getMembersWithLogins(): Promise<
  Record<string, { userId: string; username: string; pin: string }>
> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return {};

  const rows = await db
    .select({
      userId: appUsers.id,
      memberId: appUsers.memberId,
      username: appUsers.username,
      pin: appUsers.pin,
    })
    .from(appUsers)
    .where(eq(appUsers.role, 'user'));

  const byMember: Record<string, { userId: string; username: string; pin: string }> = {};
  for (const r of rows) {
    if (r.memberId) byMember[r.memberId] = { userId: r.userId, username: r.username, pin: r.pin };
  }
  return byMember;
}

export async function regenerateMemberPin(
  userId: string,
): Promise<{ success: boolean; error?: string; pin?: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  const pin = await regeneratePin(userId);
  // Deliberately not written to the audit log.
  await writeAudit('REGENERATE_PIN', 'app_user', userId, null);
  revalidatePath('/manage-team');
  return { success: true, pin };
}

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
): Promise<{
  success: boolean;
  error?: string;
  id?: string;
  memberCode?: string;
  username?: string;
  pin?: string;
}> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  const parsed = addMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;
  const id = nanoid(12);

  // Member codes are assigned by the server, not entered by the admin. Take the
  // highest number already in use and add one. member_code carries a unique
  // index, so a racing insert loses and we retry with the next number.
  let memberCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db
      .select({
        next: sql<number>`coalesce(max(nullif(regexp_replace(${teamMembers.memberCode}, '\\D', '', 'g'), '')::int), 0) + 1`,
      })
      .from(teamMembers);

    memberCode = String(row?.next ?? 1).padStart(3, '0');

    try {
      await db.insert(teamMembers).values({
        id,
        fullName: data.fullName,
        memberCode,
        categoryId: data.categoryId,
        positionId: data.positionId,
        displayOrder: data.displayOrder,
      });
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('team_members_member_code_uniq')) throw e;
      if (attempt === 4) {
        return { success: false, error: 'Could not assign a member code, please retry.' };
      }
    }
  }

  // An LER/BDM leads a team, so they also get a position of their own —
  // "Nimziya-BDM" — for the agents reporting to them to be assigned to.
  const derived = await syncLeaderPosition({
    fullName: data.fullName,
    positionId: data.positionId,
  });

  // Every member gets a login. Credentials are returned once so the admin can
  // hand them over; they stay readable on the Manage Team page.
  const credentials = await createUserForMember(id, data.fullName);

  await writeAudit('CREATE_MEMBER', 'team_member', id, {
    fullName: data.fullName,
    memberCode,
    username: credentials.username,
    ...(derived.created ? { positionCreated: derived.created } : {}),
  });
  revalidatePath('/manage-team');
  revalidatePath('/targets');
  revalidatePath('/daily-log');

  return { success: true, id, memberCode, ...credentials };
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

  // Captured before the write so a rename can move the leader's own position
  // instead of stranding it under the old name.
  const before = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
  });

  await db
    .update(teamMembers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teamMembers.id, memberId));

  const after = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, memberId),
  });
  // Also covers an agent promoted to LER/BDM, who has no position yet.
  const derived = after
    ? await syncLeaderPosition(
        { fullName: after.fullName, positionId: after.positionId },
        before?.fullName,
      )
    : {};

  await writeAudit('UPDATE_MEMBER', 'team_member', memberId, {
    ...data,
    ...(derived.created ? { positionCreated: derived.created } : {}),
    ...(derived.renamed ? { positionRenamed: derived.renamed } : {}),
  });
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
