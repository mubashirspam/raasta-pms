'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { memberProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { contactsSchema } from '@/lib/validators/profile';
import { CONTACT_KEYS, type Contacts } from '@/lib/domain/contacts';
import { getCurrentMember, isAdminAuthenticated } from '@/lib/auth-server';
import { writeAudit } from '@/lib/auth';

const EMPTY: Contacts = {
  whatsapp: null,
  instagramUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  facebookUrl: null,
  linkedinUrl: null,
};

function pickContacts(row: Partial<Contacts> | undefined | null): Contacts {
  const out = { ...EMPTY };
  for (const k of CONTACT_KEYS) out[k] = row?.[k] ?? null;
  return out;
}

/** The signed-in member's own contact details. Never anyone else's. */
export async function getMyContacts(): Promise<Contacts & { updatedAt: Date | null }> {
  const ctx = await getCurrentMember();
  if (!ctx) return { ...EMPTY, updatedAt: null };

  const row = await db.query.memberProfiles.findFirst({
    where: eq(memberProfiles.memberId, ctx.member.id),
  });
  return { ...pickContacts(row), updatedAt: row?.updatedAt ?? null };
}

/**
 * Saves the signed-in member's contact details. The member is taken from the
 * session, never from the request, so nobody can write to another profile.
 */
export async function updateMyContacts(raw: unknown): Promise<{
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof Contacts, string>>;
}> {
  const ctx = await getCurrentMember();
  if (!ctx) return { success: false, error: 'Not authenticated' };

  const parsed = contactsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof Contacts, string>> = {};
    for (const issue of parsed.error.errors) {
      const key = issue.path[0] as keyof Contacts;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { success: false, error: 'Check the highlighted fields', fieldErrors };
  }

  const memberId = ctx.member.id;
  const data = parsed.data;
  const before = pickContacts(
    await db.query.memberProfiles.findFirst({ where: eq(memberProfiles.memberId, memberId) }),
  );
  const changed = CONTACT_KEYS.filter((k) => before[k] !== data[k]);
  if (changed.length === 0) return { success: true };

  await db
    .insert(memberProfiles)
    .values({ memberId, ...data })
    .onConflictDoUpdate({
      target: memberProfiles.memberId,
      set: { ...data, updatedAt: new Date() },
    });

  // Which fields moved, not their values — the numbers stay on the profile.
  await writeAudit('UPDATE_PROFILE', 'team_member', memberId, { changed }, ctx.user.username);
  revalidatePath('/profile');
  revalidatePath('/manage-team');

  return { success: true };
}

/** Contact details keyed by member id, for the Team page. Admin-only. */
export async function getContactsByMember(): Promise<Record<string, Contacts>> {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) return {};

  const rows = await db.select().from(memberProfiles);
  return Object.fromEntries(rows.map((r) => [r.memberId, pickContacts(r)]));
}
