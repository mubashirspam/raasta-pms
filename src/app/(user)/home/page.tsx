import Link from 'next/link';
import { requireMember } from '@/lib/auth-server';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { MONTHS } from '@/lib/domain/helpers';
import { Target, ClipboardList, ChevronRight } from 'lucide-react';

const TILES = [
  {
    href: '/targets',
    label: 'Weekly Target',
    hint: 'Set or review this week’s target',
    Icon: Target,
  },
  {
    href: '/daily-log',
    label: 'Daily Log',
    hint: 'Submit today’s numbers',
    Icon: ClipboardList,
  },
] as const;

export default async function UserHomePage() {
  const { member } = await requireMember();
  const { month, year } = currentMonthYearDubai();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-raasta-ink">
          Hello, {member.fullName.split(' ')[0]}
        </h1>
        <p className="text-sm text-raasta-muted mt-1">
          {member.category.name} · {MONTHS[month]} {year}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TILES.map(({ href, label, hint, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group bg-raasta-surface border border-raasta-border rounded-2xl p-5 shadow-card hover:shadow-lift hover:border-gold-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-gold-600" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-raasta-ink">{label}</p>
                <p className="text-xs text-raasta-muted mt-0.5">{hint}</p>
              </div>
              <ChevronRight
                className="w-5 h-5 text-raasta-faint group-hover:text-gold-600 transition-colors shrink-0"
                aria-hidden="true"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
