import { requireAdmin } from '@/lib/auth-server';
import { AppShell } from '@/components/AppShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <AppShell role="admin" username={user.username} displayName="Admin" subtitle="Team Najeeb">
      {children}
    </AppShell>
  );
}
