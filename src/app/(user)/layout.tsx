import { requireMember } from '@/lib/auth-server';
import { AppShell } from '@/components/AppShell';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await requireMember();

  return (
    <AppShell
      role="user"
      username={user.username}
      displayName={member.fullName}
      subtitle={`${member.memberCode} · ${member.position.name}`}
    >
      {children}
    </AppShell>
  );
}
