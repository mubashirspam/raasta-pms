'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import {
  weeklyTargets,
  teamRevenueTargets,
  teamMembers,
  positions,
  notifications,
  creatorTeamAgents,
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  salesTargetSchema,
  creatorTargetSchema,
  creatorTeamAgentSchema,
} from '@/lib/validators/targets';
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

  // One row per agent, so "already submitted" means any row exists for the week.
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

  // Only agents actually on this creator's team may be targeted.
  const roster = await db.query.creatorTeamAgents.findMany({
    where: eq(creatorTeamAgents.creatorId, data.memberId),
  });
  const rosterIds = new Set(roster.map((r) => r.agentId));
  const stray = data.agentTargets.find((t) => !rosterIds.has(t.agentId));
  if (stray) {
    return { success: false, error: 'That agent is not on your team.' };
  }

  const referenceNumber = generateRef('TGT');

  // One creator-level row (agent_id null) carrying the Team / Raasta page video
  // target, plus one row per agent. All of it lands together or not at all.
  await db.transaction(async (tx) => {
    await tx.insert(weeklyTargets).values([
      {
        memberId: data.memberId,
        weekId: data.weekId,
        agentId: null,
        teamVideosTarget: data.teamVideosTarget,
        referenceNumber,
      },
      ...data.agentTargets.map((t) => ({
        memberId: data.memberId,
        weekId: data.weekId,
        agentId: t.agentId,
        reelsTarget: t.reelsTarget,
        viralVideosTarget: t.viralVideosTarget,
        leadsTarget: t.leadsTarget,
        picsTarget: t.picsTarget,
        referenceNumber,
      })),
    ]);

    await tx
      .update(teamMembers)
      .set({ lastSubmissionAt: new Date() })
      .where(eq(teamMembers.id, data.memberId));
  });

  revalidatePath('/analytics');
  revalidatePath('/targets');

  return { success: true, referenceNumber };
}

// ─── Creator team roster ───────────────────────────────────────────────────────

export async function getCreatorTeam(creatorId: string) {
  return db.query.creatorTeamAgents.findMany({
    where: eq(creatorTeamAgents.creatorId, creatorId),
    with: { agent: { with: { category: true, position: true } } },
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.createdAt)],
  });
}

// creatorId -> that creator's agents, for pre-filling the target form.
export async function getCreatorTeamsMap() {
  const rows = await db.query.creatorTeamAgents.findMany({
    with: { agent: { with: { category: true, position: true } } },
    orderBy: (t, { asc }) => [asc(t.displayOrder), asc(t.createdAt)],
  });

  const map: Record<string, (typeof rows)[number]['agent'][]> = {};
  for (const r of rows) {
    (map[r.creatorId] ??= []).push(r.agent);
  }
  return map;
}

export async function addCreatorTeamAgent(
  raw: unknown,
): Promise<{ success: boolean; error?: string }> {
  const parsed = creatorTeamAgentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }

  const { creatorId, agentId } = parsed.data;

  const agent = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.id, agentId),
    with: { category: true },
  });
  if (!agent || !agent.isActive) {
    return { success: false, error: 'Agent not found' };
  }
  if (agent.category.name !== 'Sales Agent') {
    return { success: false, error: 'Only sales agents can join a creator team.' };
  }

  await db
    .insert(creatorTeamAgents)
    .values({ creatorId, agentId })
    .onConflictDoNothing();

  revalidatePath('/targets');
  return { success: true };
}

export async function removeCreatorTeamAgent(
  creatorId: string,
  agentId: string,
): Promise<{ success: boolean; error?: string }> {
  await db
    .delete(creatorTeamAgents)
    .where(
      and(
        eq(creatorTeamAgents.creatorId, creatorId),
        eq(creatorTeamAgents.agentId, agentId),
      ),
    );

  revalidatePath('/targets');
  return { success: true };
}

/** Every target row this member has for the given weeks, agent rows included. */
export async function getTargetsForWeeks(memberId: string, weekIds: number[]) {
  if (!weekIds.length) return [];
  return db.query.weeklyTargets.findMany({
    where: and(
      eq(weeklyTargets.memberId, memberId),
      inArray(weeklyTargets.weekId, weekIds),
    ),
    with: { agent: true },
  });
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
