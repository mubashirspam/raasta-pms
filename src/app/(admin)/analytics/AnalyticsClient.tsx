'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MetricBar } from '@/components/ui/MetricBar';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { PlatformBars, PlatformChips } from '@/components/charts/PlatformBars';
import { RangePicker } from '@/components/analytics/RangePicker';
import { cn, fmtAED } from '@/lib/domain/helpers';
import {
  approveCorrectionRequest,
  rejectCorrectionRequest,
} from '@/lib/actions/corrections';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/actions/analytics';
import type { RangeAnalytics, MemberAnalytics } from '@/lib/actions/analytics';
import type {
  TeamMember,
  EmployeeCategory,
  Position,
  Notification,
  CorrectionRequest,
  OperationalWeek,
} from '@/db/schema';

type MemberWithRelations = TeamMember & { category: EmployeeCategory; position: Position };
type NotificationWithMember = Notification & { member: MemberWithRelations | null };
type CorrectionWithMember = CorrectionRequest & { member: MemberWithRelations };

interface Props {
  analytics: RangeAnalytics | null;
  weeks: OperationalWeek[];
  notifications: NotificationWithMember[];
  pendingCorrections: CorrectionWithMember[];
  month: number;
  year: number;
  preset: string;
}

type Tab = 'overview' | 'members' | 'platforms' | 'corrections' | 'notifications';
type MemberFilter = 'all' | 'sales' | 'creator';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  members: 'Members',
  platforms: 'Platforms',
  corrections: 'Corrections',
  notifications: 'Alerts',
};

export function AnalyticsClient({
  analytics,
  weeks,
  notifications,
  pendingCorrections,
  month,
  year,
  preset,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const unreadCount = notifications.length;
  const a = analytics;

  // Only people with something recorded in the period are worth a card.
  const activeMembers = useMemo(
    () =>
      (a?.memberSummaries ?? []).filter(
        (m) =>
          m.logsSubmitted > 0 ||
          m.viralTotal > 0 ||
          m.metrics.some((x) => x.actual > 0 || x.target > 0),
      ),
    [a],
  );

  const filteredMembers = useMemo(
    () =>
      memberFilter === 'all'
        ? activeMembers
        : activeMembers.filter((m) => m.kind === memberFilter),
    [activeMembers, memberFilter],
  );

  const creatorsWithViral = activeMembers.filter(
    (m) => m.kind === 'creator' && m.viralTotal > 0,
  );
  const agentsWithViral = activeMembers.filter(
    (m) => m.kind !== 'creator' && m.viralTotal > 0,
  );

  async function handleApprove(id: number) {
    setProcessingId(id);
    const result = await approveCorrectionRequest(id);
    setProcessingId(null);
    if (result.success) {
      toast.success('Correction approved');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Failed');
    }
  }

  async function handleReject(id: number) {
    if (!rejectNote.trim()) {
      toast.error('Admin note required to reject');
      return;
    }
    setProcessingId(id);
    const result = await rejectCorrectionRequest(id, rejectNote);
    setProcessingId(null);
    if (result.success) {
      toast.success('Correction rejected');
      setRejectNote('');
      setRejectingId(null);
      router.refresh();
    } else {
      toast.error(result.error ?? 'Failed');
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    toast.success('All notifications marked as read');
    router.refresh();
  }

  const achievement =
    a && a.revenueTarget > 0 ? Math.round((a.revenueActual / a.revenueTarget) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-raasta-ink">Analytics</h1>
        <p className="text-sm text-raasta-muted">
          {a?.range.label ?? '—'}
          {a && (
            <span className="text-raasta-faint">
              {' '}· {a.range.from} → {a.range.to}
            </span>
          )}
        </p>
      </div>

      <RangePicker
        basePath="/analytics"
        month={month}
        year={year}
        preset={preset}
        weeks={weeks}
        from={a?.range.from ?? ''}
        to={a?.range.to ?? ''}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-raasta-subtle rounded-xl p-1 overflow-x-auto scrollbar-hide">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 shrink-0 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
              tab === t
                ? 'bg-raasta-surface text-raasta-ink shadow-card'
                : 'text-raasta-muted hover:text-raasta-ink',
            )}
          >
            {TAB_LABELS[t]}
            {t === 'corrections' && pendingCorrections.length > 0 && ` (${pendingCorrections.length})`}
            {t === 'notifications' && unreadCount > 0 && ` (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* ── Overview ───────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {!a ? (
            <Card>
              <p className="text-raasta-muted text-sm">No data for this period.</p>
            </Card>
          ) : (
            <>
              <Card>
                <p className="text-xs text-raasta-muted">Revenue this period</p>
                <p className="text-gold-600 font-bold text-2xl tabular-nums mt-0.5">
                  {fmtAED(a.revenueActual)}
                </p>
                <p className="text-xs text-raasta-muted mt-1">
                  {a.revenueTarget > 0
                    ? `${achievement}% of ${fmtAED(Math.round(a.revenueTarget))} target`
                    : 'No revenue target set for this period'}
                </p>
                {a.revenueTarget > 0 && (
                  <div className="h-2 bg-raasta-subtle rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-gold-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, achievement ?? 0)}%` }}
                    />
                  </div>
                )}
              </Card>

              {/* Every target dimension, not just revenue. */}
              <Card>
                <CardTitle className="mb-1">Target achievement</CardTitle>
                <p className="text-xs text-raasta-muted mb-4">
                  Weekly targets are prorated to the selected period.
                </p>
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {a.totals.map((m) => (
                    <MetricBar
                      key={m.key}
                      label={m.label}
                      actual={m.actual}
                      target={m.target}
                      format={m.format}
                    />
                  ))}
                </div>
              </Card>

              <Card>
                <CardTitle className="mb-3">Viral videos by platform</CardTitle>
                <PlatformBars data={a.platforms} />
              </Card>

              <Card>
                <CardTitle className="mb-3">Cumulative revenue vs target</CardTitle>
                <RevenueChart data={a.cumulativeSeries} targetTotal={a.revenueTarget} />
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Members ────────────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['all', 'sales', 'creator'] as MemberFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setMemberFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  memberFilter === f
                    ? 'bg-gold-400 text-raasta-ink border-gold-400'
                    : 'bg-raasta-surface border-raasta-border text-raasta-muted hover:text-raasta-ink',
                )}
              >
                {f === 'all' ? 'Everyone' : f === 'sales' ? 'Sales Agents' : 'Content Creators'}
              </button>
            ))}
          </div>

          {filteredMembers.length === 0 ? (
            <Card>
              <p className="text-raasta-muted text-sm">No member data for this period.</p>
            </Card>
          ) : (
            filteredMembers.map((ms) => <MemberCard key={ms.memberId} ms={ms} />)
          )}
        </div>
      )}

      {/* ── Platforms ──────────────────────────────────────────────────────── */}
      {tab === 'platforms' && (
        <div className="space-y-3">
          <Card>
            <CardTitle className="mb-1">All viral videos</CardTitle>
            <p className="text-xs text-raasta-muted mb-4">
              Videos past 100k views, counted on the platform they landed on.
            </p>
            <PlatformBars data={a?.platforms ?? []} />
          </Card>

          <Card>
            <CardTitle className="mb-1">By content creator</CardTitle>
            <p className="text-xs text-raasta-muted mb-4">Who produced them.</p>
            {creatorsWithViral.length === 0 ? (
              <p className="text-sm text-raasta-faint">Nothing recorded in this period.</p>
            ) : (
              <div className="space-y-4">
                {creatorsWithViral.map((m) => (
                  <div key={m.memberId}>
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-raasta-ink truncate">{m.fullName}</p>
                      <span className="text-xs tabular-nums text-raasta-muted shrink-0">
                        {m.viralTotal} total
                      </span>
                    </div>
                    <PlatformChips data={m.platforms} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle className="mb-1">By sales agent</CardTitle>
            <p className="text-xs text-raasta-muted mb-4">Who they were made for.</p>
            {agentsWithViral.length === 0 ? (
              <p className="text-sm text-raasta-faint">Nothing recorded in this period.</p>
            ) : (
              <div className="space-y-4">
                {agentsWithViral.map((m) => (
                  <div key={m.memberId}>
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-raasta-ink truncate">{m.fullName}</p>
                      <span className="text-xs tabular-nums text-raasta-muted shrink-0">
                        {m.viralTotal} total
                      </span>
                    </div>
                    <PlatformChips data={m.platforms} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Corrections ────────────────────────────────────────────────────── */}
      {tab === 'corrections' && (
        <div className="space-y-3">
          {pendingCorrections.length === 0 ? (
            <Card>
              <p className="text-raasta-muted text-sm">No pending corrections.</p>
            </Card>
          ) : (
            pendingCorrections.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-raasta-ink font-semibold text-sm capitalize">
                      {c.recordType} Correction
                    </p>
                    <p className="text-xs text-raasta-muted">{c.member.fullName}</p>
                  </div>
                  <Badge variant="amber">Pending</Badge>
                </div>
                <p className="text-sm text-raasta-muted mb-3">{c.reason}</p>

                <div className="bg-raasta-subtle rounded-lg p-3 mb-3 text-xs">
                  <p className="text-raasta-muted mb-1">Proposed Changes:</p>
                  <pre className="text-raasta-ink whitespace-pre-wrap">
                    {JSON.stringify(c.proposedChanges, null, 2)}
                  </pre>
                </div>

                {rejectingId === c.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full bg-raasta-subtle border border-raasta-border rounded-lg px-3 py-2 text-raasta-ink text-sm resize-none focus:outline-none focus:border-gold-400"
                      rows={2}
                      placeholder="Admin note (required)"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={processingId === c.id}
                        onClick={() => handleReject(c.id)}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" loading={processingId === c.id} onClick={() => handleApprove(c.id)}>
                      ✓ Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setRejectingId(c.id)}>
                      ✕ Reject
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Notifications ──────────────────────────────────────────────────── */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          )}
          {notifications.length === 0 ? (
            <Card>
              <p className="text-raasta-muted text-sm">No unread notifications.</p>
            </Card>
          ) : (
            notifications.map((n) => (
              <Card key={n.id} className={n.isRead ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-raasta-ink font-semibold text-sm">{n.title}</p>
                    <p className="text-xs text-raasta-muted mt-1">{n.body}</p>
                    {n.member && (
                      <p className="text-xs text-raasta-faint mt-1">{n.member.fullName}</p>
                    )}
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={async () => {
                        await markNotificationRead(n.id);
                        router.refresh();
                      }}
                      className="text-xs text-gold-600 hover:text-gold-400 shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({ ms }: { ms: MemberAnalytics }) {
  const scored = ms.metrics.filter((m) => m.target > 0);
  const met = scored.filter((m) => m.actual >= m.target).length;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <p className="text-raasta-ink font-semibold text-sm truncate">{ms.fullName}</p>
          <p className="text-xs text-raasta-muted truncate">
            {ms.memberCode} · {ms.positionName}
          </p>
        </div>
        {scored.length > 0 && (
          <Badge variant={met === scored.length ? 'green' : met > 0 ? 'amber' : 'red'}>
            {met}/{scored.length} targets met
          </Badge>
        )}
      </div>

      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {ms.metrics.map((m) => (
          <MetricBar
            key={m.key}
            label={m.label}
            actual={m.actual}
            target={m.target}
            format={m.format}
          />
        ))}
      </div>

      {ms.platforms.length > 0 && (
        <div className="mt-4 pt-3 border-t border-raasta-line">
          <p className="text-xs text-raasta-muted mb-2">Viral videos by platform</p>
          <PlatformChips data={ms.platforms} />
        </div>
      )}

      <div className="flex gap-4 mt-4 pt-3 border-t border-raasta-line text-xs text-raasta-muted">
        <span>
          Logs <span className="text-raasta-ink tabular-nums font-medium">{ms.logsSubmitted}</span>
        </span>
        <span>
          Present <span className="text-raasta-ink tabular-nums font-medium">{ms.daysPresent}</span>
        </span>
        <span>
          Absent <span className="text-raasta-ink tabular-nums font-medium">{ms.daysAbsent}</span>
        </span>
      </div>
    </Card>
  );
}
