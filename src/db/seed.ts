/**
 * Seeds the database with required initial data.
 * Run once after first migration: pnpm db:seed
 */
import { db } from './index';
import { adminSettings, employeeCategories, positions, appUsers } from './schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generatePin } from '../lib/auth';

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

  // Positions are scoped to a category, so look the ids up first.
  const cats = await db.select().from(employeeCategories);
  const salesId = cats.find((c) => c.name === 'Sales Agent')!.id;
  const creatorId = cats.find((c) => c.name === 'Content Creator')!.id;

  await db
    .insert(positions)
    .values([
      { name: 'Agent', categoryId: salesId, displayOrder: 1 },
      { name: 'LER', categoryId: salesId, displayOrder: 2 },
      { name: 'BDM', categoryId: salesId, displayOrder: 3 },
      { name: 'Senior', categoryId: creatorId, displayOrder: 1 },
      { name: 'Junior', categoryId: creatorId, displayOrder: 2 },
    ])
    .onConflictDoNothing({ target: positions.name });

  // Admin login — created once, with a random PIN printed here only.
  const [existingAdmin] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.username, 'admin'));

  if (existingAdmin) {
    console.log('Admin already exists (username: admin) — PIN unchanged.');
  } else {
    const pin = generatePin();
    await db.insert(appUsers).values({
      id: nanoid(12),
      username: 'admin',
      pin,
      role: 'admin',
      memberId: null,
    });
    console.log('');
    console.log('  Admin created:');
    console.log('    username: admin');
    console.log(`    PIN:      ${pin}`);
    console.log('');
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
