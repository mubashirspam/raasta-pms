import { TargetsClient } from './TargetsClient';
import { getMembers } from '@/lib/actions/members';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { getWeeksForMonth } from '@/lib/actions/weeks';
import { getCreatorTeam, getTargetsForWeeks } from '@/lib/actions/targets';
import { requireMember } from '@/lib/auth-server';

export default async function TargetsPage() {
  const { member } = await requireMember();
  const { month, year } = currentMonthYearDubai();

  const isCreator = member.category.name === 'Content Creator';
  const weeks = await getWeeksForMonth(year, month);

  const [salesAgents, myTeam, submitted] = await Promise.all([
    // Only creators need the agent list, for building their roster.
    isCreator ? getMembers({ categoryId: 1, isActive: true }) : Promise.resolve([]),
    isCreator ? getCreatorTeam(member.id) : Promise.resolve([]),
    getTargetsForWeeks(member.id, weeks.map((w) => w.id)),
  ]);

  return (
    <TargetsClient
      member={member}
      weeks={weeks}
      month={month}
      year={year}
      salesAgents={salesAgents}
      myTeam={myTeam.map((r) => r.agent)}
      submitted={submitted}
    />
  );
}
