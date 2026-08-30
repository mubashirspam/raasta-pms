import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-server';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'admin' ? '/analytics' : '/home');

  return <LoginForm />;
}
