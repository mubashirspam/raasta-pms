import { Suspense } from 'react';
import { TargetsClient } from './TargetsClient';
import { getMembers } from '@/lib/actions/members';
import { currentMonthYearDubai } from '@/lib/domain/weeks';
import { getWeeksForMonth } from '@/lib/actions/weeks';

export default async function TargetsPage() {
  const { month, year } = currentMonthYearDubai();
  const [salesMembers, creatorMembers, weeks] = await Promise.all([
    getMembers({ categoryId: 1, isActive: true }),   // Sales Agents
    getMembers({ categoryId: 2, isActive: true }),   // Content Creators
    getWeeksForMonth(year, month),
  ]);

  return (
    <Suspense fallback={<div className="animate-pulse h-40 bg-raasta-card rounded-xl" />}>
      <TargetsClient
        salesMembers={salesMembers}
        creatorMembers={creatorMembers}
        weeks={weeks}
        month={month}
        year={year}
      />
    </Suspense>
  );
}
