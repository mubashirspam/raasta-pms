'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  correctionRequests,
  dailyLogs,
  weeklyTargets,
  notifications,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { correctionRequestSchema } from '@/lib/validators/daily-log';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { writeAudit } from '@/lib/auth';
import { headers } from 'next/headers';

export async function submitCorrectionRequest(
  raw: unknown,
): Promise<{ success: boolean; error?: string }> {
  const parsed = correctionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;

  await db.insert(correctionRequests).values({
    recordType: data.recordType,
    recordId: data.recordId,
    memberId: data.memberId,
    proposedChanges: data.proposedChanges,
    originalValues: data.originalValues,
    reason: data.reason,
    status: 'pending',
  });

  // Notify admin
  await db.insert(notifications).values({
    type: 'correction_request',
    title: 'New Correction Request',
    body: `A correction request has been submitted for a ${data.recordType}. Reason: ${data.reason.slice(0, 100)}`,
    memberId: data.memberId,
  });

  revalidatePath('/analytics');

  return { success: true };
}

export async function approveCorrectionRequest(
  correctionId: number,
  adminNote?: string,
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  const headersList = headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  // Fetch correction
  const correction = await db.query.correctionRequests.findFirst({
    where: eq(correctionRequests.id, correctionId),
  });

  if (!correction) return { success: false, error: 'Correction request not found' };
  if (correction.status !== 'pending') {
    return { success: false, error: 'Already reviewed' };
  }

  const proposedChanges = correction.proposedChanges as Record<string, unknown>;

  // Apply changes in transaction + update correction status + add notification
  await db.transaction(async (tx) => {
    // Apply proposed changes to the record
    if (correction.recordType === 'log') {
      await tx
        .update(dailyLogs)
        .set({
          ...(proposedChanges as Partial<typeof dailyLogs.$inferInsert>),
          status: 'corrected',
        })
        .where(eq(dailyLogs.id, correction.recordId));
    } else if (correction.recordType === 'target') {
      await tx
        .update(weeklyTargets)
        .set({
          ...(proposedChanges as Partial<typeof weeklyTargets.$inferInsert>),
          status: 'corrected',
        })
        .where(eq(weeklyTargets.id, correction.recordId));
    }

    // Mark correction as approved
    await tx
      .update(correctionRequests)
      .set({
        status: 'approved',
        adminNote: adminNote ?? null,
        reviewedAt: new Date(),
        reviewedBy: 'admin',
      })
      .where(eq(correctionRequests.id, correctionId));

    // Notify member
    await tx.insert(notifications).values({
      type: 'correction_approved',
      title: 'Correction Approved',
      body: `Your correction request has been approved.${adminNote ? ` Note: ${adminNote}` : ''}`,
      memberId: correction.memberId,
    });
  });

  await writeAudit(
    'APPROVE_CORRECTION',
    'correction_request',
    correctionId,
    { recordType: correction.recordType, recordId: correction.recordId },
    ip,
  );

  revalidatePath('/analytics');

  return { success: true };
}

export async function rejectCorrectionRequest(
  correctionId: number,
  adminNote: string,
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return { success: false, error: 'Not authenticated' };

  const headersList = headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  const correction = await db.query.correctionRequests.findFirst({
    where: eq(correctionRequests.id, correctionId),
  });

  if (!correction) return { success: false, error: 'Not found' };
  if (correction.status !== 'pending') return { success: false, error: 'Already reviewed' };

  await db.transaction(async (tx) => {
    await tx
      .update(correctionRequests)
      .set({
        status: 'rejected',
        adminNote,
        reviewedAt: new Date(),
        reviewedBy: 'admin',
      })
      .where(eq(correctionRequests.id, correctionId));

    await tx.insert(notifications).values({
      type: 'correction_rejected',
      title: 'Correction Rejected',
      body: `Your correction request was rejected. Admin note: ${adminNote}`,
      memberId: correction.memberId,
    });
  });

  await writeAudit(
    'REJECT_CORRECTION',
    'correction_request',
    correctionId,
    { adminNote },
    ip,
  );

  revalidatePath('/analytics');

  return { success: true };
}

export async function getPendingCorrections() {
  return db.query.correctionRequests.findMany({
    where: eq(correctionRequests.status, 'pending'),
    with: { member: { with: { category: true, position: true } } },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
}

export async function getAllCorrections() {
  return db.query.correctionRequests.findMany({
    with: { member: { with: { category: true, position: true } } },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}
