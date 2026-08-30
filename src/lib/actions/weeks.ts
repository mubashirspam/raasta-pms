'use server';

import { db } from '@/db';
import { operationalWeeks } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { generateWeeksForMonth } from '@/lib/domain/weeks';

/**
 * Returns weeks for a given month/year, upserting any that are missing.
 */
export async function getWeeksForMonth(
  year: number,
  month: number,
): Promise<typeof operationalWeeks.$inferSelect[]> {
  // Generate the canonical week list
  const generated = generateWeeksForMonth(year, month);

  // Upsert all generated weeks (idempotent — unique on start_date)
  for (const w of generated) {
    await db
      .insert(operationalWeeks)
      .values({
        weekNumber: w.weekNumber,
        month: w.month,
        year: w.year,
        startDate: w.startDate,
        endDate: w.endDate,
        label: w.label,
      })
      .onConflictDoUpdate({
        target: operationalWeeks.startDate,
        set: {
          weekNumber: w.weekNumber,
          month: w.month,
          year: w.year,
          endDate: w.endDate,
          label: w.label,
        },
      });
  }

  // Return the four canonical weeks by start date, not everything tagged with
  // this month. Weeks generated under the old Mon–Sat scheme still carry the
  // month, and targets already reference them, so those rows stay in the table
  // and keep counting in analytics — they just no longer show up as pickable
  // weeks alongside the current four.
  return db.query.operationalWeeks.findMany({
    where: inArray(
      operationalWeeks.startDate,
      generated.map((w) => w.startDate),
    ),
    orderBy: (t, { asc }) => [asc(t.startDate)],
  });
}
