import Link from 'next/link';
import { requireMember } from '@/lib/auth-server';
import { getMyAchievement } from '@/lib/actions/my-performance';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { MONTHS } from '@/lib/domain/helpers';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MetricBar } from '@/components/ui/MetricBar';
import { StatTiles } from '@/components/ui/StatTiles';
import { PlatformChips } from '@/components/charts/PlatformBars';
import { Logo } from '@/components/ui/Logo';
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

  // Scoped to the signed-in member by their session — never another person's.
  const mine = await getMyAchievement();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Logo size={48} priority className="ring-2 ring-gold-300" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-raasta-ink truncate">
            Hello, {member.fullName.split(' ')[0]}
          </h1>
          <p className="text-sm text-raasta-muted mt-0.5">
            {member.category.name} · {MONTHS[month]} {year}
          </p>
        </div>
      </div>

      {/* Your own progress, above the actions. */}
      {mine && (
        <Card>
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="min-w-0">
              <CardTitle>Your achievement</CardTitle>
              <p className="text-xs text-raasta-muted mt-0.5">{mine.range.label} so far</p>
            </div>
            {mine.targetsSet > 0 && (
              <Badge
                variant={
                  mine.targetsMet === mine.targetsSet
                    ? 'green'
                    : mine.targetsMet > 0
                    ? 'amber'
                    : 'red'
                }
              >
                {mine.targetsMet}/{mine.targetsSet} targets met
              </Badge>
            )}
          </div>

          {mine.targetsSet === 0 && mine.logsSubmitted === 0 ? (
            <p className="text-sm text-raasta-muted">
              Nothing logged yet this month. Submit a daily log and your progress shows up here.
            </p>
          ) : (
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {mine.metrics.map((m) => (
                <MetricBar
                  key={m.key}
                  label={m.label}
                  actual={m.actual}
                  target={m.target}
                  format={m.format}
                />
              ))}
            </div>
          )}

          {mine.cumulative.length > 0 && (
            <div className="mt-4 pt-3 border-t border-raasta-line">
              <p className="text-xs text-raasta-muted mb-2">Cumulative — no target</p>
              <StatTiles stats={mine.cumulative} compact />
            </div>
          )}

          {mine.platforms.length > 0 && (
            <div className="mt-4 pt-3 border-t border-raasta-line">
              <p className="text-xs text-raasta-muted mb-2">Viral videos by platform</p>
              <PlatformChips data={mine.platforms} />
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-raasta-line text-xs text-raasta-muted">
            <span>
              Logs <span className="text-raasta-ink tabular-nums font-medium">{mine.logsSubmitted}</span>
            </span>
            <span>
              Present <span className="text-raasta-ink tabular-nums font-medium">{mine.daysPresent}</span>
            </span>
            <span>
              Remote <span className="text-raasta-ink tabular-nums font-medium">{mine.daysRemote}</span>
            </span>
            <span>
              Absent <span className="text-raasta-ink tabular-nums font-medium">{mine.daysAbsent}</span>
            </span>
          </div>
        </Card>
      )}

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
