/**
 * Seeds the database with required initial data.
 * Run once after first migration: pnpm db:seed
 */
import { db } from './index';
import { adminSettings, employeeCategories, positions } from './schema';

async function seed() {
  console.log('Seeding database...');

  // Admin settings singleton
  await db
    .insert(adminSettings)
    .values({ id: 1 })
    .onConflictDoNothing({ target: adminSettings.id });

  // Employee categories
  await db
    .insert(employeeCategories)
    .values([
      { name: 'Sales Agent', displayOrder: 1 },
      { name: 'Content Creator', displayOrder: 2 },
    ])
    .onConflictDoNothing({ target: employeeCategories.name });

  // Positions
  await db
    .insert(positions)
    .values([
      { name: 'Agent', displayOrder: 1 },
      { name: 'LER', displayOrder: 2 },
      { name: 'BDM', displayOrder: 3 },
    ])
    .onConflictDoNothing({ target: positions.name });

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
