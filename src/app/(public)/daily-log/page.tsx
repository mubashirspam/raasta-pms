import { Suspense } from 'react';
import { DailyLogClient } from './DailyLogClient';
import { getMembers } from '@/lib/actions/members';
import { todayDubai } from '@/lib/domain/weeks';

export default async function DailyLogPage() {
  const today = todayDubai();
  const [salesMembers, creatorMembers] = await Promise.all([
    getMembers({ categoryId: 1, isActive: true }),
    getMembers({ categoryId: 2, isActive: true }),
  ]);

  return (
    <Suspense fallback={<div className="animate-pulse h-40 bg-raasta-card rounded-xl" />}>
      <DailyLogClient
        salesMembers={salesMembers}
        creatorMembers={creatorMembers}
        today={today}
      />
    </Suspense>
  );
}
