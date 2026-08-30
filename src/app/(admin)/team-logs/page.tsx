import { TeamLogsClient } from './TeamLogsClient';
import { getMembers } from '@/lib/actions/members';
import {
  getMemberLogCalendar,
  getLogDetail,
  getMonthSubmissionCounts,
} from '@/lib/actions/team-logs';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { requireAdmin } from '@/lib/auth-server';

export default async function TeamLogsPage({
  searchParams,
}: {
  searchParams: { memberId?: string; month?: string; year?: string; date?: string };
}) {
  await requireAdmin();

  const { month: currentMonth, year: currentYear } = currentMonthYearDubai();
  const month = Number(searchParams.month ?? currentMonth);
  const year = Number(searchParams.year ?? currentYear);

  const members = await getMembers();
  // Default to the first member so the page is never an empty shell.
  const memberId =
    searchParams.memberId && members.some((m) => m.id === searchParams.memberId)
      ? searchParams.memberId
      : members[0]?.id ?? null;

  const [calendar, detail, counts] = await Promise.all([
    memberId ? getMemberLogCalendar(memberId, month, year) : Promise.resolve([]),
    memberId && searchParams.date
      ? getLogDetail(memberId, searchParams.date)
      : Promise.resolve(null),
    getMonthSubmissionCounts(
      month,
      year,
      members.map((m) => m.id),
    ),
  ]);

  return (
    <TeamLogsClient
      members={members}
      memberId={memberId}
      month={month}
      year={year}
      calendar={calendar}
      detail={detail}
      selectedDate={searchParams.date ?? null}
      counts={counts}
    />
  );
}
