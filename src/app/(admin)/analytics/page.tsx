import { AdminGate } from '@/components/AdminGate';
import { AnalyticsClient } from './AnalyticsClient';
import { getOverviewAnalytics } from '@/lib/actions/analytics';
import { getMembers } from '@/lib/actions/members';
import { getNotifications } from '@/lib/actions/analytics';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { getPendingCorrections } from '@/lib/actions/corrections';
import { isAdminAuthenticated } from '@/lib/auth-server';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const isAdmin = await isAdminAuthenticated();

  if (!isAdmin) {
    return <AdminGate>{null}</AdminGate>;
  }

  const { month: currentMonth, year: currentYear } = currentMonthYearDubai();
  const month = Number(searchParams.month ?? currentMonth);
  const year = Number(searchParams.year ?? currentYear);

  const [analytics, members, notifications, pendingCorrections] = await Promise.all([
    getOverviewAnalytics(month, year),
    getMembers({ isActive: true }),
    getNotifications(true), // unread only
    getPendingCorrections(),
  ]);

  return (
    <AnalyticsClient
      analytics={analytics}
      members={members}
      notifications={notifications}
      pendingCorrections={pendingCorrections}
      month={month}
      year={year}
    />
  );
}
