'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/domain/helpers';
import { Logo } from '@/components/ui/Logo';
import { logoutAction } from '@/lib/actions/auth';
import {
  Home,
  Target,
  ClipboardList,
  BarChart3,
  CalendarDays,
  Users,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const USER_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/targets', label: 'Target', Icon: Target },
  { href: '/daily-log', label: 'Daily Log', Icon: ClipboardList },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/team-targets', label: 'Targets', Icon: Target },
  { href: '/team-logs', label: 'Daily Logs', Icon: CalendarDays },
  { href: '/manage-team', label: 'Team', Icon: Users },
];

export function NavBar({
  role,
  username,
  displayName,
  subtitle,
}: {
  role: 'admin' | 'user';
  username: string;
  displayName: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const items = role === 'admin' ? ADMIN_ITEMS : USER_ITEMS;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAction();
  }

  return (
    <>
      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-30 bg-raasta-surface/90 backdrop-blur border-b border-raasta-border px-4 py-3 flex items-center gap-3">
        <Logo size={28} className="ring-1 ring-gold-300" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-raasta-ink truncate">{displayName}</p>
          {subtitle && <p className="text-[11px] text-raasta-muted truncate">{subtitle}</p>}
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Sign out"
          className="ml-auto p-2 -mr-2 rounded-lg text-raasta-muted hover:text-bad-500 hover:bg-raasta-subtle transition-colors disabled:opacity-40"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-raasta-surface border-r border-raasta-border flex-col py-6 px-3 z-40">
        <div className="flex items-center gap-3 px-3 mb-8">
          <Logo size={32} className="ring-1 ring-gold-300" />
          <div className="min-w-0">
            <p className="font-bold text-sm tracking-tight text-raasta-ink leading-tight">
              Team Najeeb
            </p>
            <p className="text-[11px] text-raasta-muted leading-tight">Performance Tracker</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-gold-50 text-gold-700 border border-gold-200'
                  : 'text-raasta-muted hover:text-raasta-ink hover:bg-raasta-subtle border border-transparent',
              )}
              aria-current={isActive(href) ? 'page' : undefined}
            >
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-raasta-line">
          <div className="px-3 mb-2">
            <p className="text-sm font-medium text-raasta-ink truncate">{displayName}</p>
            <p className="text-[11px] text-raasta-muted truncate">@{username}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-raasta-muted hover:text-bad-500 hover:bg-bad-50 transition-colors disabled:opacity-40"
          >
            <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </nav>

      {/* Mobile tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-raasta-surface/95 backdrop-blur border-t border-raasta-border pb-safe">
        <div className="flex">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive(href) ? 'text-gold-600' : 'text-raasta-faint',
              )}
              aria-current={isActive(href) ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
