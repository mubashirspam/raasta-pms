import { AdminGate } from '@/components/AdminGate';
import { ManageTeamClient } from './ManageTeamClient';
import { getMembers } from '@/lib/actions/members';
import { isAdminAuthenticated } from '@/lib/auth-server';
import { db } from '@/db';

export default async function ManageTeamPage() {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return <AdminGate>{null}</AdminGate>;
  }

  const [members, categories, positions] = await Promise.all([
    getMembers(),
    db.query.employeeCategories.findMany({ orderBy: (t, { asc }) => [asc(t.displayOrder)] }),
    db.query.positions.findMany({ orderBy: (t, { asc }) => [asc(t.displayOrder)] }),
  ]);

  return (
    <ManageTeamClient
      members={members}
      categories={categories}
      positions={positions}
    />
  );
}
