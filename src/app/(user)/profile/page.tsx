import { ProfileClient } from './ProfileClient';
import { requireMember } from '@/lib/auth-server';
import { getMyContacts } from '@/lib/actions/profile';

export default async function ProfilePage() {
  const { user, member } = await requireMember();
  const { updatedAt, ...contacts } = await getMyContacts();

  return (
    <ProfileClient
      fullName={member.fullName}
      username={user.username}
      subtitle={`${member.memberCode} · ${member.position.name} · ${member.category.name}`}
      contacts={contacts}
      updatedAt={updatedAt?.toISOString() ?? null}
    />
  );
}
