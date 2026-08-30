import { NavBar } from './NavBar';

interface Props {
  role: 'admin' | 'user';
  username: string;
  displayName: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Page frame shared by the admin and user areas: brand header, role-aware
 * navigation (desktop sidebar / mobile tab bar) and the content column.
 */
export function AppShell({ role, username, displayName, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-raasta-bg">
      <NavBar role={role} username={username} displayName={displayName} subtitle={subtitle} />

      <main className="md:pl-60">
        <div className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-10">{children}</div>
      </main>
    </div>
  );
}
