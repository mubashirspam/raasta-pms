'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/domain/helpers';

const NAV_ITEMS = [
  {
    href: '/targets',
    label: 'Targets',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" strokeWidth="2" />
        <circle cx="12" cy="12" r="8" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: '/daily-log',
    label: 'Daily Log',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/manage-team',
    label: 'Team',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
] as const;

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-raasta-dark border-r border-raasta-border flex-col py-6 px-3 z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-raasta-black font-black text-xs">R</span>
          </div>
          <div>
            <div className="text-gold-500 font-bold text-sm leading-none">RAASTA</div>
            <div className="text-white text-xs leading-none mt-0.5">Realty</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-gold-500/10 text-gold-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto px-3">
          <p className="text-[10px] text-gray-600">Team Najeeb Tracker</p>
        </div>
      </nav>

      {/* Desktop content offset */}
      <div className="hidden md:block w-56 shrink-0" />

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-raasta-dark/95 backdrop-blur border-t border-raasta-border">
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-gold-500' : 'text-gray-500',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
