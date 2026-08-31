'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  dailyLogs,
  developerVisits,
  creatorDailyMetrics,
  creatorAgentDailyMetrics,
  creatorShootParticipants,
  viralPlatformCounts,
  extraWorkRecords,
  teamMembers,
  creatorTeamAgents,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { salesLogSchema, creatorLogSchema } from '@/lib/validators/daily-log';
import { generateRef } from '@/lib/domain/helpers';

// Every day of the week is a working day, Sunday included — no date is refused.

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
        organicCallMinutes: data.organicCallMinutes,
        marketingCallMinutes: data.marketingCallMinutes,
        connectedCalls,
        videoCalls: data.videoCalls,
        faceToFace: data.faceToFace,
        reelsUploaded: data.reelsUploaded,
        uploadedPlatforms: data.uploadedPlatforms,
        selfieVideos: data.selfieVideos,
        leadsReceived: data.leadsReceived,
        salesRevenue: String(data.salesRevenue),
        teamRevenue: data.teamRevenue === undefined ? null : String(data.teamRevenue),
        connectedSelfCircle: data.connectedSelfCircle,
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

  const existing = await db.query.dailyLogs.findFirst({
    where: and(
      eq(dailyLogs.memberId, data.memberId),
      eq(dailyLogs.logDate, data.logDate),
    ),
  });
  if (existing) {
    return { success: false, error: 'Log already submitted for this date.' };
  }

  // Only agents actually on this creator's team may be logged.
  const roster = await db.query.creatorTeamAgents.findMany({
    where: eq(creatorTeamAgents.creatorId, data.memberId),
  });
  const rosterIds = new Set(roster.map((r) => r.agentId));
  if (data.agentMetrics.some((m) => !rosterIds.has(m.agentId))) {
    return { success: false, error: 'That agent is not on your team.' };
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

    // Creator metrics — the day's roll-up, summed from the per-agent rows.
    await tx.insert(creatorDailyMetrics).values({
      logId,
      reelsGiven: data.agentMetrics.reduce((s, m) => s + m.reelsGiven, 0),
      viralVideos: data.agentMetrics.reduce(
        (s, m) => s + m.viralPlatforms.reduce((x, r) => x + r.count, 0),
        0,
      ),
      leadsGenerated: data.agentMetrics.reduce((s, m) => s + m.leadsGenerated, 0),
      picsGiven: data.agentMetrics.reduce((s, m) => s + m.picsGiven, 0),
      longFormVideos: data.agentMetrics.reduce((s, m) => s + m.longFormVideos, 0),
      instagramVideos: data.instagramVideos,
      remarks: data.remarks,
    });

    // Per-agent breakdown
    await tx.insert(creatorAgentDailyMetrics).values(
      data.agentMetrics.map((m) => ({
        logId,
        agentId: m.agentId,
        reelsGiven: m.reelsGiven,
        viralVideos: m.viralPlatforms.reduce((x, r) => x + r.count, 0),
        leadsGenerated: m.leadsGenerated,
        picsGiven: m.picsGiven,
        longFormVideos: m.longFormVideos,
      })),
    );

    // Which platform each agent's viral videos landed on
    const platformRows = data.agentMetrics.flatMap((m) =>
      m.viralPlatforms
        .filter((r) => r.count > 0)
        .map((r) => ({ logId, agentId: m.agentId, platform: r.platform, count: r.count })),
    );
    if (platformRows.length) {
      await tx.insert(viralPlatformCounts).values(platformRows);
    }

    // Shoot participants
    if (data.shootParticipantIds?.length) {
      await tx.insert(creatorShootParticipants).values(
        data.shootParticipantIds.map((memberId) => ({ logId, memberId })),
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
