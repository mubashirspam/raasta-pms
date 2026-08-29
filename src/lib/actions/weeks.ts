'use server';

import { db } from '@/db';
import { operationalWeeks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

  // Return only weeks assigned to the requested month
  return db.query.operationalWeeks.findMany({
    where: and(
      eq(operationalWeeks.month, month),
      eq(operationalWeeks.year, year),
    ),
    orderBy: (t, { asc }) => [asc(t.startDate)],
  });
}
