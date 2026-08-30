import { AnalyticsClient } from './AnalyticsClient';
import { getRangeAnalytics, getNotifications } from '@/lib/actions/analytics';
import { getWeeksForMonth } from '@/lib/actions/weeks';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { resolveRange } from '@/lib/domain/ranges';
import { getPendingCorrections } from '@/lib/actions/corrections';
import { requireAdmin } from '@/lib/auth-server';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: {
    preset?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
  };
}) {
  await requireAdmin();

  const { month: currentMonth, year: currentYear } = currentMonthYearDubai();
  const preset = searchParams.preset ?? 'month';

  let month = Number(searchParams.month ?? currentMonth);
  let year = Number(searchParams.year ?? currentYear);

  // "Last month" shifts the anchor before the weeks are looked up, so the label
  // and the week chips both describe the month actually being measured.
  if (preset === 'last-month') {
    const d = new Date(year, month - 2, 1);
    month = d.getMonth() + 1;
    year = d.getFullYear();
  }

  // Operational weeks straddle calendar boundaries, so a "month" runs from the
  // first Monday of its first week to the Saturday of its last.
  const weeks = await getWeeksForMonth(year, month);
  const monthRange = weeks.length
    ? { from: weeks[0].startDate, to: weeks[weeks.length - 1].endDate }
    : null;

  const { range, preset: resolvedPreset } = resolveRange(
    { preset, month, year, from: searchParams.from, to: searchParams.to },
    monthRange,
    currentMonth,
    currentYear,
  );

  const [analytics, notifications, pendingCorrections] = await Promise.all([
    getRangeAnalytics(range),
    getNotifications(true), // unread only
    getPendingCorrections(),
  ]);

  return (
    <AnalyticsClient
      analytics={analytics}
      weeks={weeks}
      notifications={notifications}
      pendingCorrections={pendingCorrections}
      month={month}
      year={year}
      currentMonth={currentMonth}
      currentYear={currentYear}
      preset={resolvedPreset}
    />
  );
}
