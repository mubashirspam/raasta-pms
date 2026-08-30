'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { fmtAED, MONTHS } from '@/lib/domain/helpers';
import {
  approveCorrectionRequest,
  rejectCorrectionRequest,
} from '@/lib/actions/corrections';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/actions/analytics';
import type { TeamMember, EmployeeCategory, Position, Notification, CorrectionRequest } from '@/db/schema';

type MemberWithRelations = TeamMember & { category: EmployeeCategory; position: Position };

interface MemberSummary {
  member: MemberWithRelations;
  revenue: number;
  target: number;
  logsSubmitted: number;
  onTarget: boolean;
}

interface Analytics {
  cumulativeSeries: Array<{ date: string; cumulative: number }>;
  totalRevenue: number;
  totalTarget: number;
  memberSummaries: MemberSummary[];
}

type NotificationWithMember = Notification & { member: MemberWithRelations | null };
type CorrectionWithMember = CorrectionRequest & { member: MemberWithRelations };

interface Props {
  analytics: Analytics | null;
  members: MemberWithRelations[];
  notifications: NotificationWithMember[];
  pendingCorrections: CorrectionWithMember[];
  month: number;
  year: number;
}

type Tab = 'overview' | 'members' | 'corrections' | 'notifications';

export function AnalyticsClient({
  analytics,
  members,
  notifications,
  pendingCorrections,
  month,
  year,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.length;

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
    setShowNotifications(false);
  }

  const a = analytics;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-raasta-ink">Analytics</h1>
          <p className="text-sm text-raasta-muted">{MONTHS[month]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 text-raasta-muted hover:text-raasta-ink rounded-lg hover:bg-raasta-subtle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-gold-400 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {[-2, -1, 0].map((offset) => {
          const d = new Date(year, month - 1 + offset, 1);
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          const active = m === month && y === year;
          return (
            <button
              key={offset}
              onClick={() => router.push(`/analytics?month=${m}&year=${y}`)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active ? 'bg-gold-400 text-raasta-ink' : 'bg-raasta-surface border border-raasta-border text-raasta-muted hover:text-raasta-ink'
              }`}
            >
              {MONTHS[m]} {y}
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-raasta-subtle rounded-xl p-1">
        {(['overview', 'members', 'corrections', 'notifications'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-raasta-surface text-raasta-ink' : 'text-raasta-muted hover:text-raasta-ink'
            }`}
          >
            {t === 'corrections' && pendingCorrections.length > 0
              ? `${t} (${pendingCorrections.length})`
              : t === 'notifications' && unreadCount > 0
              ? `🔔 ${unreadCount}`
              : t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {!a ? (
            <Card><p className="text-raasta-muted text-sm">No data for this period.</p></Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <p className="text-xs text-raasta-muted mb-1">Total Revenue</p>
                  <p className="text-gold-600 font-bold text-lg">{fmtAED(a.totalRevenue)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-raasta-muted mb-1">Revenue Target</p>
                  <p className="text-raasta-ink font-bold text-lg">{fmtAED(a.totalTarget)}</p>
                </Card>
              </div>

              {/* Achievement bar */}
              <Card>
                <div className="flex justify-between text-xs text-raasta-muted mb-2">
                  <span>Achievement</span>
                  <span>{a.totalTarget > 0 ? Math.round((a.totalRevenue / a.totalTarget) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-raasta-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, a.totalTarget > 0 ? (a.totalRevenue / a.totalTarget) * 100 : 0)}%` }}
                  />
                </div>
              </Card>

              {/* Cumulative revenue area chart */}
              <Card>
                <CardTitle className="mb-3">Cumulative Revenue vs Target</CardTitle>
                <RevenueChart data={a.cumulativeSeries} targetTotal={a.totalTarget} />
              </Card>
            </>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-3">
          {analytics?.memberSummaries.map((ms) => (
            <Card key={ms.member.id}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-raasta-ink font-semibold text-sm">{ms.member.fullName}</p>
                  <p className="text-xs text-raasta-muted">{ms.member.memberCode} · {ms.member.position.name}</p>
                </div>
                <StatusBadge onTarget={ms.onTarget} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mt-3">
                <div>
                  <p className="text-xs text-raasta-muted">Revenue</p>
                  <p className="text-gold-600 font-semibold text-sm">{fmtAED(ms.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-raasta-muted">Target</p>
                  <p className="text-raasta-ink text-sm">{fmtAED(ms.target)}</p>
                </div>
                <div>
                  <p className="text-xs text-raasta-muted">Logs</p>
                  <p className="text-raasta-ink text-sm">{ms.logsSubmitted}</p>
                </div>
              </div>
              <div className="h-1.5 bg-raasta-subtle rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gold-400 rounded-full"
                  style={{ width: `${Math.min(100, ms.target > 0 ? (ms.revenue / ms.target) * 100 : 0)}%` }}
                />
              </div>
            </Card>
          ))}
          {!analytics?.memberSummaries.length && (
            <Card><p className="text-raasta-muted text-sm">No member data for this period.</p></Card>
          )}
        </div>
      )}

      {/* Corrections tab */}
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
                    <p className="text-raasta-ink font-semibold text-sm capitalize">{c.recordType} Correction</p>
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
                      <Button variant="danger" size="sm" loading={processingId === c.id}
                        onClick={() => handleReject(c.id)}>Confirm Reject</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setRejectingId(null); setRejectNote(''); }}>
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

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          )}
          {notifications.length === 0 ? (
            <Card><p className="text-raasta-muted text-sm">No unread notifications.</p></Card>
          ) : (
            notifications.map((n) => (
              <Card key={n.id} className={n.isRead ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-raasta-ink font-semibold text-sm">{n.title}</p>
                    <p className="text-xs text-raasta-muted mt-1">{n.body}</p>
                    {n.member && <p className="text-xs text-raasta-faint mt-1">{n.member.fullName}</p>}
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={async () => { await markNotificationRead(n.id); router.refresh(); }}
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
