'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  dailyLogs,
  developerVisits,
  creatorDailyMetrics,
  creatorShootParticipants,
  viralVideoRecords,
  leadDistributions,
  instagramVideoRecords,
  extraWorkRecords,
  teamMembers,
  workingDayExceptions,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { salesLogSchema, creatorLogSchema } from '@/lib/validators/daily-log';
import { isSundayDubai } from '@/lib/domain/weeks';
import { generateRef } from '@/lib/domain/helpers';

async function isAllowedDate(dateStr: string): Promise<boolean> {
  if (!isSundayDubai(dateStr)) return true;

  // Check for special Sunday exception
  const exception = await db.query.workingDayExceptions.findFirst({
    where: and(
      eq(workingDayExceptions.exceptionDate, dateStr),
      eq(workingDayExceptions.type, 'special_sunday'),
    ),
  });

  return exception != null;
}

export async function submitSalesLog(
  raw: unknown,
): Promise<{ success: boolean; error?: string; referenceNumber?: string }> {
  const parsed = salesLogSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Validation error',
    };
  }

  const data = parsed.data;

  // Sunday check
  const allowed = await isAllowedDate(data.logDate);
  if (!allowed) {
    return { success: false, error: 'Daily logs cannot be submitted on Sundays.' };
  }

  // Duplicate check
  const existing = await db.query.dailyLogs.findFirst({
    where: and(
      eq(dailyLogs.memberId, data.memberId),
      eq(dailyLogs.logDate, data.logDate),
    ),
  });
  if (existing) {
    return {
      success: false,
      error: 'You have already submitted a log for this date.',
    };
  }

  const referenceNumber = generateRef('LOG');
  const connectedCalls = data.organicCalls + data.marketingCalls;

  // All sub-record inserts in a single transaction
  await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(dailyLogs)
      .values({
        memberId: data.memberId,
        logDate: data.logDate,
        attendance: data.attendance,
        absenceNote: data.absenceNote,
        arrivalTiming: data.arrivalTiming,
        lateReason: data.lateReason,
        organicCalls: data.organicCalls,
        marketingCalls: data.marketingCalls,
        connectedCalls,
        videoCalls: data.videoCalls,
        faceToFace: data.faceToFace,
        reelsUploaded: data.reelsUploaded,
        leadsReceived: data.leadsReceived,
        salesRevenue: String(data.salesRevenue),
        learnedToday: data.learnedToday,
        issuesToday: data.issuesToday,
        referenceNumber,
        backdated: data.logDate < new Date().toISOString().slice(0, 10),
      })
      .returning();

    const logId = log.id;

    // Developer visits
    if (data.developerVisited && data.developerNames?.length) {
      await tx.insert(developerVisits).values(
        data.developerNames.map((name) => ({ logId, developerName: name })),
      );
    }
  });

  await db
    .update(teamMembers)
    .set({ lastSubmissionAt: new Date() })
    .where(eq(teamMembers.id, data.memberId));

  revalidatePath('/analytics');

  return { success: true, referenceNumber };
}

export async function submitCreatorLog(
  raw: unknown,
): Promise<{ success: boolean; error?: string; referenceNumber?: string }> {
  const parsed = creatorLogSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Validation error',
    };
  }

  const data = parsed.data;

  const allowed = await isAllowedDate(data.logDate);
  if (!allowed) {
    return { success: false, error: 'Daily logs cannot be submitted on Sundays.' };
  }

  const existing = await db.query.dailyLogs.findFirst({
    where: and(
      eq(dailyLogs.memberId, data.memberId),
      eq(dailyLogs.logDate, data.logDate),
    ),
  });
  if (existing) {
    return { success: false, error: 'Log already submitted for this date.' };
  }

  // Viral video URL deduplication check
  if (data.viralVideoRows?.length) {
    for (const vr of data.viralVideoRows) {
      const dupe = await db.query.viralVideoRecords.findFirst({
        where: eq(viralVideoRecords.videoUrl, vr.videoUrl),
      });
      if (dupe) {
        return {
          success: false,
          error: `Viral video URL already recorded: ${vr.videoUrl}`,
        };
      }
    }
  }

  const referenceNumber = generateRef('LOG');
  const connectedCalls = 0; // Creators don't have organic/marketing calls

  await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(dailyLogs)
      .values({
        memberId: data.memberId,
        logDate: data.logDate,
        attendance: data.attendance,
        absenceNote: data.absenceNote,
        arrivalTiming: data.arrivalTiming,
        lateReason: data.lateReason,
        organicCalls: 0,
        marketingCalls: 0,
        connectedCalls,
        videoCalls: 0,
        faceToFace: 0,
        reelsUploaded: 0,
        leadsReceived: 0,
        salesRevenue: '0',
        referenceNumber,
        backdated: data.logDate < new Date().toISOString().slice(0, 10),
      })
      .returning();

    const logId = log.id;

    // Creator metrics
    await tx.insert(creatorDailyMetrics).values({
      logId,
      reelsGiven: data.reelsGiven,
      viralVideos: data.viralVideos,
      leadsGenerated: data.leadsGenerated,
      instagramVideos: data.instagramVideos,
      remarks: data.remarks,
    });

    // Shoot participants
    if (data.shootParticipantIds?.length) {
      await tx.insert(creatorShootParticipants).values(
        data.shootParticipantIds.map((memberId) => ({ logId, memberId })),
      );
    }

    // Viral video details
    if (data.viralVideoRows?.length) {
      await tx.insert(viralVideoRecords).values(
        data.viralVideoRows.map((vr) => ({
          logId,
          title: vr.title,
          contentOwnerId: vr.contentOwnerId ?? null,
          platform: vr.platform ?? null,
          videoUrl: vr.videoUrl,
          contentId: vr.contentId ?? null,
          crossed100kAt: vr.crossed100kAt ?? null,
          currentViews: vr.currentViews,
        })),
      );
    }

    // Lead distributions
    if (data.leadDistRows?.length) {
      await tx.insert(leadDistributions).values(
        data.leadDistRows.map((ld) => ({
          logId,
          recipientId: ld.recipientId ?? null,
          recipientLabel: ld.recipientLabel ?? null,
          leadsCount: ld.leadsCount,
          note: ld.note ?? null,
        })),
      );
    }

    // IG video records
    if (data.igVideoRows?.length) {
      await tx.insert(instagramVideoRecords).values(
        data.igVideoRows.map((ig) => ({
          logId,
          title: ig.title,
          status: ig.status,
          platform: ig.platform ?? null,
          link: ig.link || null,
          contentRef: ig.contentRef ?? null,
          note: ig.note ?? null,
        })),
      );
    }

    // Extra work records
    if (data.extraWorkRows?.length) {
      await tx.insert(extraWorkRecords).values(
        data.extraWorkRows.map((ew) => ({
          logId,
          workType: ew.workType,
          quantity: ew.quantity,
          explanation: ew.explanation ?? null,
          link: ew.link || null,
        })),
      );
    }
  });

  await db
    .update(teamMembers)
    .set({ lastSubmissionAt: new Date() })
    .where(eq(teamMembers.id, data.memberId));

  revalidatePath('/analytics');

  return { success: true, referenceNumber };
}

export async function getLogsForMember(memberId: string) {
  return db.query.dailyLogs.findMany({
    where: eq(dailyLogs.memberId, memberId),
    with: {
      developerVisits: true,
      creatorDailyMetrics: true,
    },
    orderBy: (t, { desc }) => [desc(t.logDate)],
  });
}
