import { TeamTargetsClient } from './TeamTargetsClient';
import { getMembers } from '@/lib/actions/members';
import { getCreatorTeam } from '@/lib/actions/targets';
import {
  getMemberTargetCalendar,
  getTargetDetail,
  getMonthTargetCounts,
} from '@/lib/actions/team-targets';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { requireAdmin } from '@/lib/auth-server';

/** A search param that must be a number, falling back when it is junk. */
function numParam(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export default async function TeamTargetsPage({
  searchParams,
}: {
  searchParams: { memberId?: string; month?: string; year?: string; weekId?: string };
}) {
  await requireAdmin();

  const { month: currentMonth, year: currentYear } = currentMonthYearDubai();
  const month = Math.min(12, Math.max(1, numParam(searchParams.month, currentMonth)));
  const year = Math.min(2100, Math.max(2000, numParam(searchParams.year, currentYear)));

  const members = await getMembers();
  // Default to the first member so the page is never an empty shell.
  const memberId =
    searchParams.memberId && members.some((m) => m.id === searchParams.memberId)
      ? searchParams.memberId
      : members[0]?.id ?? null;

  const [calendar, counts] = await Promise.all([
    memberId ? getMemberTargetCalendar(memberId, month, year) : Promise.resolve([]),
    getMonthTargetCounts(
      month,
      year,
      members.map((m) => m.id),
    ),
  ]);

  // Only a week belonging to the month on screen may be opened, so a stale or
  // hand-edited weekId cannot pull up a target from somewhere else.
  const requestedWeekId = numParam(searchParams.weekId, 0);
  const selectedWeekId = calendar.some((w) => w.week.id === requestedWeekId)
    ? requestedWeekId
    : null;

  const detail =
    memberId && selectedWeekId ? await getTargetDetail(memberId, selectedWeekId) : null;

  // Adding an agent to a creator's week offers their roster first; the picker
  // needs to know who is on it to say so.
  const selectedMember = members.find((m) => m.id === memberId) ?? null;
  const rosterAgentIds =
    selectedMember?.category.name === 'Content Creator'
      ? (await getCreatorTeam(selectedMember.id)).map((r) => r.agentId)
      : [];

  return (
    <TeamTargetsClient
      members={members}
      memberId={memberId}
      month={month}
      year={year}
      currentMonth={currentMonth}
      currentYear={currentYear}
      calendar={calendar}
      detail={detail}
      selectedWeekId={selectedWeekId}
      counts={counts}
      rosterAgentIds={rosterAgentIds}
    />
  );
}
