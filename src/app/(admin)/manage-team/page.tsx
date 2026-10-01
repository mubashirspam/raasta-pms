import { ManageTeamClient } from './ManageTeamClient';
import { getMembers, getMembersWithLogins } from '@/lib/actions/members';
import { getContactsByMember } from '@/lib/actions/profile';
import { requireAdmin } from '@/lib/auth-server';
import { db } from '@/db';

export default async function ManageTeamPage() {
  await requireAdmin();

  const [members, logins, contacts, categories, positions] = await Promise.all([
    getMembers(),
    getMembersWithLogins(),
    getContactsByMember(),
    db.query.employeeCategories.findMany({ orderBy: (t, { asc }) => [asc(t.displayOrder)] }),
    db.query.positions.findMany({ orderBy: (t, { asc }) => [asc(t.displayOrder)] }),
  ]);

  return (
    <ManageTeamClient
      members={members}
      logins={logins}
      contacts={contacts}
      categories={categories}
      positions={positions}
    />
  );
}
