'use server';

/**
 * Admin view of everybody's weekly targets, and the only place a submitted
 * target can be changed.
 *
 * A target locks the moment the member submits it — that is the whole point of
 * the weekly commitment. The admin is the escape hatch for the cases the lock
 * cannot anticipate: a number typed into the wrong field, a revenue target
 * agreed verbally after the fact, a week set up before a member changed role.
 * Every override is written to audit_log with a full before/after diff and the
 * member is notified, so an edited target is never a silent one.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/db';
import {
  weeklyTargets,
  notifications,
  type OperationalWeek,
} from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getCurrentUser, isAdminAuthenticated } from '@/lib/auth-server';
import { writeAudit } from '@/lib/auth';
import { getWeeksForMonth } from '@/lib/actions/weeks';
import { todayDubai } from '@/lib/domain/weeks';
import {
  adminSalesTargetEditSchema,
  adminCreatorTargetEditSchema,
} from '@/lib/validators/targets';

export type WeekTargetState =
  | 'submitted' // the member committed to numbers for this week
  | 'missing'   // the week has started and nothing was submitted
  | 'upcoming'; // not reachable yet

export interface WeekTargetSummary {
  week: OperationalWeek;
  state: WeekTargetState;
  /** How many target rows back this week — creators file one per agent. */
  rowCount: number;
  edited: boolean;
  positionFlagged: boolean;
  submittedAt: string | null;
}

type ActionResult = { success: boolean; error?: string; unchanged?: boolean };

const NOT_ADMIN: ActionResult = { success: false, error: 'Not authenticated' };

/** Pages that read weekly targets and must not serve a stale copy after an edit. */
function revalidateTargetReaders() {
  revalidatePath('/team-targets');
  revalidatePath('/analytics');
  revalidatePath('/targets');
  revalidatePath('/home');
}

function clientIp(): string | undefined {
  return headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
}

/**
 * Fields that changed, as `{ field: { from, to } }`. Numbers are compared
 * numerically so "5000.00" and 5000 do not read as an edit — decimals come
 * back from Postgres as strings.
 */
function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    const prev = before[key];
    const same =
      prev == null && next == null
        ? true
        : prev == null || next == null
          ? false
          : Number(prev) === Number(next);
    if (!same) out[key] = { from: prev ?? null, to: next };
  }
  return out;
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

/**
 * One entry per operational week of the month describing whether this member
 * committed to a target for it. Drives the week cards on the admin targets
 * page — the admin needs to see the weeks that were skipped, not only the
 * weeks that were filled in.
 */
export async function getMemberTargetCalendar(
  memberId: string,
  month: number,
  year: number,
): Promise<WeekTargetSummary[]> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return [];

  const weeks = await getWeeksForMonth(year, month);
  if (weeks.length === 0) return [];

  const today = todayDubai();
  const rows = await db
    .select({
      weekId: weeklyTargets.weekId,
      editedAt: weeklyTargets.editedAt,
      positionFlagged: weeklyTargets.positionFlagged,
      submittedAt: weeklyTargets.submittedAt,
    })
    .from(weeklyTargets)
    .where(
      and(
        eq(weeklyTargets.memberId, memberId),
        inArray(
          weeklyTargets.weekId,
          weeks.map((w) => w.id),
        ),
      ),
    );

  const byWeek = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byWeek.get(r.weekId) ?? [];
    list.push(r);
    byWeek.set(r.weekId, list);
  }

  return weeks.map((week) => {
    const weekRows = byWeek.get(week.id) ?? [];
    const state: WeekTargetState = weekRows.length
      ? 'submitted'
      : week.startDate > today
        ? 'upcoming'
        : 'missing';

    // The earliest submission is the moment the member actually committed;
    // a creator's per-agent rows all land in the same transaction.
    const submittedAt = weekRows.reduce<Date | null>(
      (earliest, r) => (!earliest || r.submittedAt < earliest ? r.submittedAt : earliest),
      null,
    );

    return {
      week,
      state,
      rowCount: weekRows.length,
      edited: weekRows.some((r) => r.editedAt !== null),
      positionFlagged: weekRows.some((r) => r.positionFlagged),
      submittedAt: submittedAt ? submittedAt.toISOString() : null,
    };
  });
}

/**
 * Every target row this member filed for one week, agent rows resolved to
 * names. Empty when the week was skipped.
 */
export async function getTargetDetail(memberId: string, weekId: number) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return null;

  const rows = await db.query.weeklyTargets.findMany({
    where: and(eq(weeklyTargets.memberId, memberId), eq(weeklyTargets.weekId, weekId)),
    with: {
      agent: { with: { position: true } },
      week: true,
      member: { with: { category: true, position: true } },
    },
    orderBy: (t, { asc }) => [asc(t.agentId), asc(t.id)],
  });

  return rows.length ? rows : null;
}

export type TargetDetail = NonNullable<Awaited<ReturnType<typeof getTargetDetail>>>;
export type TargetDetailRow = TargetDetail[number];

/**
 * Month-level roll-up per member: how many of the month's weeks carry a
 * target. Shown beside each name in the member picker.
 */
export async function getMonthTargetCounts(
  month: number,
  year: number,
  memberIds: string[],
): Promise<Record<string, { weeksSet: number; edited: number }>> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin || memberIds.length === 0) return {};

  const weeks = await getWeeksForMonth(year, month);
  if (weeks.length === 0) return {};

  const rows = await db
    .select({
      memberId: weeklyTargets.memberId,
      weekId: weeklyTargets.weekId,
      editedAt: weeklyTargets.editedAt,
    })
    .from(weeklyTargets)
    .where(
      and(
        inArray(weeklyTargets.memberId, memberIds),
        inArray(
          weeklyTargets.weekId,
          weeks.map((w) => w.id),
        ),
      ),
    );

  // A creator files several rows per week, so weeks are counted as a set.
  const weeksByMember = new Map<string, Set<number>>();
  const editedWeeksByMember = new Map<string, Set<number>>();
  for (const r of rows) {
    const set = weeksByMember.get(r.memberId) ?? new Set<number>();
    set.add(r.weekId);
    weeksByMember.set(r.memberId, set);

    if (r.editedAt) {
      const edited = editedWeeksByMember.get(r.memberId) ?? new Set<number>();
      edited.add(r.weekId);
      editedWeeksByMember.set(r.memberId, edited);
    }
  }

  const out: Record<string, { weeksSet: number; edited: number }> = {};
  for (const [memberId, set] of weeksByMember) {
    out[memberId] = {
      weeksSet: set.size,
      edited: editedWeeksByMember.get(memberId)?.size ?? 0,
    };
  }
  return out;
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/** The notice the member gets when their locked target moves, and why. */
function editNotification(
  memberId: string,
  weekLabel: string,
  fieldCount: number,
  reason?: string,
): typeof notifications.$inferInsert {
  return {
    type: 'target_edited',
    title: 'Target updated by admin',
    body:
      `Your target for ${weekLabel} was updated by the admin ` +
      `(${fieldCount} value${fieldCount === 1 ? '' : 's'} changed).` +
      (reason ? ` Reason: ${reason}` : ''),
    memberId,
  };
}

/**
 * Overwrite a sales member's weekly target. Only the numbers move — the week,
 * the member and the reference number are fixed, so the edited row stays the
 * same record the member submitted.
 */
export async function updateSalesTargetAsAdmin(raw: unknown): Promise<ActionResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== 'admin') return NOT_ADMIN;

  const parsed = adminSalesTargetEditSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }
  const { targetId, reason, ...values } = parsed.data;

  const existing = await db.query.weeklyTargets.findFirst({
    where: eq(weeklyTargets.id, targetId),
    with: { week: true, member: { with: { category: true } } },
  });
  if (!existing) return { success: false, error: 'Target not found' };

  // Creator targets carry a different set of fields across several rows and
  // must go through updateCreatorTargetAsAdmin, or the agent rows drift.
  if (existing.member.category.name === 'Content Creator') {
    return { success: false, error: 'Use the creator form to edit this target.' };
  }
  if (existing.agentId !== null) {
    return { success: false, error: 'That row belongs to a creator target.' };
  }

  const changes = diffFields(existing, values);
  if (Object.keys(changes).length === 0) {
    return { success: true, unchanged: true };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(weeklyTargets)
      .set({
        connectedCallsTarget: values.connectedCallsTarget,
        videoCallsTarget: values.videoCallsTarget,
        faceToFaceTarget: values.faceToFaceTarget,
        revenueTarget: String(values.revenueTarget),
        reelsUploadedTarget: values.reelsUploadedTarget,
        selfieVideosTarget: values.selfieVideosTarget,
        status: 'corrected',
        editedAt: new Date(),
        editedBy: admin.username,
        editReason: reason ?? null,
      })
      .where(eq(weeklyTargets.id, targetId));

    await tx
      .insert(notifications)
      .values(
        editNotification(
          existing.memberId,
          existing.week.label,
          Object.keys(changes).length,
          reason,
        ),
      );
  });

  await writeAudit(
    'ADMIN_EDIT_TARGET',
    'weekly_target',
    targetId,
    {
      memberId: existing.memberId,
      weekId: existing.weekId,
      weekLabel: existing.week.label,
      reason: reason ?? null,
      changes,
    },
    admin.username,
    clientIp(),
  );

  revalidateTargetReaders();
  return { success: true };
}

/**
 * Overwrite a creator's weekly target: the creator-level team-video row plus
 * one row per agent. All of it lands together or not at all, so the week is
 * never half-edited.
 */
export async function updateCreatorTargetAsAdmin(raw: unknown): Promise<ActionResult> {
  const admin = await getCurrentUser();
  if (admin?.role !== 'admin') return NOT_ADMIN;

  const parsed = adminCreatorTargetEditSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message };
  }
  const { memberId, weekId, reason, creatorRow, agentRows } = parsed.data;

  const existingRows = await db.query.weeklyTargets.findMany({
    where: and(eq(weeklyTargets.memberId, memberId), eq(weeklyTargets.weekId, weekId)),
    with: { week: true, agent: true },
  });
  if (existingRows.length === 0) {
    return { success: false, error: 'No target exists for that week.' };
  }

  const byId = new Map(existingRows.map((r) => [r.id, r]));

  // Every id must be one of this member's rows for this week. Without the
  // check, a crafted payload could rewrite somebody else's target.
  const submittedIds = [
    ...(creatorRow ? [creatorRow.targetId] : []),
    ...agentRows.map((r) => r.targetId),
  ];
  for (const id of submittedIds) {
    if (!byId.has(id)) {
      return { success: false, error: 'That target row does not belong to this week.' };
    }
  }
  if (creatorRow && byId.get(creatorRow.targetId)!.agentId !== null) {
    return { success: false, error: 'That row is an agent target, not the creator row.' };
  }
  if (agentRows.some((r) => byId.get(r.targetId)!.agentId === null)) {
    return { success: false, error: 'That row is the creator row, not an agent target.' };
  }

  const changesByRow: Record<string, Record<string, { from: unknown; to: unknown }>> = {};

  const creatorChanges = creatorRow
    ? diffFields(byId.get(creatorRow.targetId)!, {
        teamVideosTarget: creatorRow.teamVideosTarget,
      })
    : {};
  if (Object.keys(creatorChanges).length) {
    changesByRow[`creator:${creatorRow!.targetId}`] = creatorChanges;
  }

  const agentUpdates: Array<{
    row: (typeof agentRows)[number];
    changes: Record<string, { from: unknown; to: unknown }>;
  }> = [];
  for (const row of agentRows) {
    const { targetId, ...values } = row;
    const changes = diffFields(byId.get(targetId)!, values);
    if (Object.keys(changes).length) {
      agentUpdates.push({ row, changes });
      const agentName = byId.get(targetId)!.agent?.fullName ?? String(targetId);
      changesByRow[agentName] = changes;
    }
  }

  const changedFieldCount =
    Object.keys(creatorChanges).length +
    agentUpdates.reduce((n, u) => n + Object.keys(u.changes).length, 0);

  if (changedFieldCount === 0) return { success: true, unchanged: true };

  const editedAt = new Date();
  const week = existingRows[0].week;

  await db.transaction(async (tx) => {
    const stamp = {
      status: 'corrected' as const,
      editedAt,
      editedBy: admin.username,
      editReason: reason ?? null,
    };

    if (creatorRow && Object.keys(creatorChanges).length) {
      await tx
        .update(weeklyTargets)
        .set({ teamVideosTarget: creatorRow.teamVideosTarget, ...stamp })
        .where(eq(weeklyTargets.id, creatorRow.targetId));
    }

    for (const { row } of agentUpdates) {
      await tx
        .update(weeklyTargets)
        .set({
          reelsTarget: row.reelsTarget,
          viralVideosTarget: row.viralVideosTarget,
          leadsTarget: row.leadsTarget,
          picsTarget: row.picsTarget,
          longFormTarget: row.longFormTarget,
          ...stamp,
        })
        .where(eq(weeklyTargets.id, row.targetId));
    }

    await tx
      .insert(notifications)
      .values(editNotification(memberId, week.label, changedFieldCount, reason));
  });

  await writeAudit(
    'ADMIN_EDIT_TARGET',
    'weekly_target',
    `${memberId}:${weekId}`,
    {
      memberId,
      weekId,
      weekLabel: week.label,
      reason: reason ?? null,
      changes: changesByRow,
    },
    admin.username,
    clientIp(),
  );

  revalidateTargetReaders();
  return { success: true };
}
