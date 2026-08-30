import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-server';

// Everything enters through here: anonymous -> login, admin -> analytics,
// user -> their two-button home.
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(user.role === 'admin' ? '/analytics' : '/home');
}
