/**
 * Derived leader positions.
 *
 * LER and BDM each lead a team, so the position list cannot be a fixed set of
 * three: every leader needs a position of their own — "Nimziya-BDM" — that the
 * agents reporting to them can be assigned to. Those positions are generated
 * from the leader's own record rather than typed in by the admin.
 *
 * Plain and free of `'use server'` so both the members action and the backfill
 * script can call it, and imports are relative so the script resolves them
 * without Next's `@/` alias.
 */
import { db } from '../db';
import { positions } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

/** Positions that lead a team. Every holder gets a derived position. */
export const LEADER_POSITIONS = ['LER', 'BDM'] as const;
export type LeaderPosition = (typeof LEADER_POSITIONS)[number];

export const isLeaderPosition = (name: string): name is LeaderPosition =>
  (LEADER_POSITIONS as readonly string[]).includes(name);

/** positions.name is varchar(100); a long member name is trimmed to fit. */
const MAX_POSITION_NAME = 100;

/** "Nimziya" + "BDM" → "Nimziya-BDM". */
export function leaderPositionName(fullName: string, leader: string): string {
  const suffix = `-${leader}`;
  const base = fullName.trim().replace(/\s+/g, ' ');
  return base.slice(0, MAX_POSITION_NAME - suffix.length) + suffix;
}

/**
 * Makes sure the derived position for one member exists, creating it if the
 * member holds a leader position. Safe to call on every save: it is a no-op for
 * everyone else, and for a leader whose position already exists.
 *
 * `previousFullName` lets a rename follow the leader — their existing position
 * is renamed rather than left behind under the old name.
 */
export async function syncLeaderPosition(
  member: { fullName: string; positionId: number },
  previousFullName?: string,
): Promise<{ created?: string; renamed?: { from: string; to: string } }> {
  const held = await db.query.positions.findFirst({
    where: eq(positions.id, member.positionId),
  });
  // Only the base LER/BDM rows spawn a derived position. A leader already
  // sitting on a derived one would otherwise generate "Nimziya-BDM-BDM".
  if (!held || !isLeaderPosition(held.name)) return {};

  const desired = leaderPositionName(member.fullName, held.name);

  if (previousFullName && previousFullName.trim() !== member.fullName.trim()) {
    const previous = leaderPositionName(previousFullName, held.name);
    if (previous !== desired) {
      const stale = await db.query.positions.findFirst({
        where: eq(positions.name, previous),
      });
      if (stale) {
        await db.update(positions).set({ name: desired }).where(eq(positions.id, stale.id));
        return { renamed: { from: previous, to: desired } };
      }
    }
  }

  const taken = await db.query.positions.findFirst({ where: eq(positions.name, desired) });
  if (taken) return {};

  // Derived positions sort after the base ones in their category.
  const [next] = await db
    .select({
      order: sql<number>`coalesce(max(${positions.displayOrder}), 0) + 1`,
    })
    .from(positions)
    .where(eq(positions.categoryId, held.categoryId));

  await db
    .insert(positions)
    .values({
      name: desired,
      categoryId: held.categoryId,
      displayOrder: next?.order ?? 1,
    })
    // A racing insert of the same name loses; the position exists either way.
    .onConflictDoNothing({ target: positions.name });

  return { created: desired };
}

/**
 * Generates the missing derived positions for every leader already on the
 * team. Idempotent — running it twice creates nothing the second time.
 */
export async function backfillLeaderPositions(): Promise<{
  created: string[];
  skipped: number;
}> {
  const members = await db.query.teamMembers.findMany({ with: { position: true } });

  const created: string[] = [];
  let skipped = 0;

  for (const m of members) {
    if (!isLeaderPosition(m.position.name)) continue;
    const result = await syncLeaderPosition({
      fullName: m.fullName,
      positionId: m.positionId,
    });
    if (result.created) created.push(result.created);
    else skipped++;
  }

  return { created, skipped };
}
