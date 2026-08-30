import { DailyLogClient } from './DailyLogClient';
import { todayDubai } from '@/lib/domain/weeks';
import { getCreatorTeam } from '@/lib/actions/targets';
import { requireMember } from '@/lib/auth-server';

export default async function DailyLogPage() {
  const { member } = await requireMember();
  const today = todayDubai();

  const isCreator = member.category.name === 'Content Creator';
  const myTeam = isCreator ? await getCreatorTeam(member.id) : [];

  return (
    <DailyLogClient
      member={member}
      today={today}
      myTeam={myTeam.map((r) => r.agent)}
    />
  );
}
