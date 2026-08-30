'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, fmtAED, MONTHS } from '@/lib/domain/helpers';
import { parseDateString } from '@/lib/domain/weeks';
import type { CalendarDay, DayState, LogDetail } from '@/lib/actions/team-logs';
import type { TeamMember, EmployeeCategory, Position } from '@/db/schema';
import { Search, CalendarDays } from 'lucide-react';

type MemberWithRelations = TeamMember & { category: EmployeeCategory; position: Position };

interface Props {
  members: MemberWithRelations[];
  memberId: string | null;
  month: number;
  year: number;
  calendar: CalendarDay[];
  detail: LogDetail | null;
  selectedDate: string | null;
  counts: Record<string, { logged: number; absent: number }>;
}

// Mon-first grid: the work week runs Mon–Sat and Sunday is the day off.
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const gridColumn = (weekday: number) => (weekday === 0 ? 7 : weekday);

const STATE_STYLES: Record<DayState, string> = {
  present: 'bg-gold-50 border-gold-300 text-gold-700 hover:border-gold-400',
  absent: 'bg-bad-50 border-bad-500/30 text-bad-600 hover:border-bad-500',
  missing: 'bg-raasta-surface border-dashed border-raasta-border text-raasta-faint hover:border-raasta-faint',
  off: 'bg-raasta-subtle border-transparent text-raasta-faint/60',
  future: 'bg-raasta-surface border-transparent text-raasta-faint/50',
};

const LEGEND: Array<{ state: DayState; label: string }> = [
  { state: 'present', label: 'Logged' },
  { state: 'absent', label: 'Absent' },
  { state: 'missing', label: 'No log' },
  { state: 'off', label: 'Day off' },
];

export function TeamLogsClient({
  members,
  memberId,
  month,
  year,
  calendar,
  detail,
  selectedDate,
  counts,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const selectedMember = members.find((m) => m.id === memberId) ?? null;

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        m.position.name.toLowerCase().includes(q),
    );
  }, [members, query]);

  const go = (params: Record<string, string | number | null | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    router.push(`/team-logs?${qs.toString()}`);
  };

  const monthChips = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1);
    return { m: d.getMonth() + 1, y: d.getFullYear() };
  });

  const logged = calendar.filter((d) => d.state === 'present').length;
  const absent = calendar.filter((d) => d.state === 'absent').length;
  const missing = calendar.filter((d) => d.state === 'missing').length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-raasta-ink">Daily Logs</h1>
        <p className="text-sm text-raasta-muted">
          Pick a team member, then a day, to read exactly what they submitted.
        </p>
      </div>

      {/* ── 1. Who ─────────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <CardTitle>Team member</CardTitle>
          {members.length > 6 && (
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-raasta-faint"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-36 bg-raasta-subtle border border-raasta-border rounded-lg pl-8 pr-2 py-1.5 text-xs text-raasta-ink placeholder:text-raasta-faint focus:outline-none focus:border-gold-400"
              />
            </div>
          )}
        </div>

        {filteredMembers.length === 0 ? (
          <p className="text-sm text-raasta-faint">No member matches “{query}”.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredMembers.map((m) => {
              const c = counts[m.id];
              const active = m.id === memberId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => go({ memberId: m.id, month, year })}
                  className={cn(
                    'text-left px-3 py-2 rounded-xl border text-xs transition-colors',
                    active
                      ? 'bg-gold-50 border-gold-300 text-raasta-ink'
                      : 'bg-raasta-surface border-raasta-border text-raasta-muted hover:border-raasta-faint/40 hover:text-raasta-ink',
                    !m.isActive && 'opacity-60',
                  )}
                >
                  <span className="block font-semibold text-raasta-ink">
                    {m.fullName}
                    {!m.isActive && (
                      <span className="ml-1.5 font-normal text-raasta-faint">(inactive)</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-raasta-muted">
                    {m.position.name}
                    {c ? ` · ${c.logged} log${c.logged === 1 ? '' : 's'}` : ' · no logs'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {selectedMember && (
        <>
          {/* ── 2. Which month ───────────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {monthChips.map(({ m, y }) => (
              <button
                key={`${y}-${m}`}
                type="button"
                onClick={() => go({ memberId, month: m, year: y })}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                  m === month && y === year
                    ? 'bg-gold-400 text-raasta-ink border-gold-400'
                    : 'bg-raasta-surface border-raasta-border text-raasta-muted hover:text-raasta-ink hover:border-raasta-faint/40',
                )}
              >
                {MONTHS[m].slice(0, 3)} {String(y).slice(2)}
              </button>
            ))}
          </div>

          {/* ── 3. Which day ─────────────────────────────────────────────────── */}
          <Card>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <CardTitle>
                  {MONTHS[month]} {year}
                </CardTitle>
                <p className="text-xs text-raasta-muted mt-0.5">{selectedMember.fullName}</p>
              </div>
              <div className="flex gap-3 text-[11px] text-raasta-muted shrink-0">
                <span>
                  <span className="text-raasta-ink font-semibold tabular-nums">{logged}</span> logged
                </span>
                <span>
                  <span className="text-raasta-ink font-semibold tabular-nums">{absent}</span> absent
                </span>
                <span>
                  <span className="text-raasta-ink font-semibold tabular-nums">{missing}</span> missed
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {WEEKDAY_LABELS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-raasta-faint pb-1">
                  {d}
                </div>
              ))}
              {calendar.map((day, i) => {
                const clickable = day.state !== 'future';
                const selected = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={!clickable}
                    style={i === 0 ? { gridColumnStart: gridColumn(day.weekday) } : undefined}
                    onClick={() => go({ memberId, month, year, date: day.date })}
                    aria-label={`${day.date} — ${day.state}`}
                    className={cn(
                      'aspect-square rounded-lg border text-xs font-medium tabular-nums transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                      STATE_STYLES[day.state],
                      !clickable && 'cursor-default',
                      selected && 'ring-2 ring-gold-400 ring-offset-1',
                    )}
                  >
                    {day.dayOfMonth}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              {LEGEND.map(({ state, label }) => (
                <span key={state} className="inline-flex items-center gap-1.5 text-[11px] text-raasta-muted">
                  <span className={cn('w-3 h-3 rounded border', STATE_STYLES[state])} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </Card>

          {/* ── 4. The log ───────────────────────────────────────────────────── */}
          {selectedDate ? (
            detail ? (
              <LogDetailCard detail={detail} />
            ) : (
              <Card>
                <div className="flex items-center gap-2 text-raasta-muted text-sm">
                  <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {selectedMember.fullName} submitted no log for {formatDate(selectedDate)}.
                  </span>
                </div>
              </Card>
            )
          ) : (
            <Card>
              <p className="text-sm text-raasta-muted">Select a day above to read that log.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Detail rendering ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = parseDateString(dateStr);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${weekdays[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] text-raasta-muted">{label}</p>
      <p className="text-sm font-semibold text-raasta-ink tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 mt-4 border-t border-raasta-line">
      <p className="text-xs font-semibold text-raasta-muted mb-3">{title}</p>
      {children}
    </div>
  );
}

function LogDetailCard({ detail }: { detail: LogDetail }) {
  const isCreator = detail.member.category.name === 'Content Creator';
  const cm = detail.creatorDailyMetrics;

  // Viral counts arrive per agent per platform; group them under each agent.
  const platformsByAgent = new Map<string, Array<{ platform: string; count: number }>>();
  for (const row of detail.viralPlatformCounts) {
    const list = platformsByAgent.get(row.agentId) ?? [];
    list.push({ platform: row.platform, count: row.count });
    platformsByAgent.set(row.agentId, list);
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{formatDate(detail.logDate)}</CardTitle>
          <p className="text-xs text-raasta-muted mt-0.5 truncate">
            {detail.member.fullName} · {detail.member.position.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge variant={detail.attendance === 'absent' ? 'red' : 'green'}>
            {detail.attendance === 'absent' ? 'Absent' : 'Present'}
          </Badge>
          {detail.backdated && <Badge variant="amber">Backdated</Badge>}
        </div>
      </div>

      <p className="text-[11px] text-raasta-faint mt-2">
        Ref {detail.referenceNumber} · submitted{' '}
        {new Date(detail.submittedAt).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}
      </p>

      {detail.attendance === 'absent' ? (
        <Section title="Absence">
          <p className="text-sm text-raasta-ink">
            {detail.absenceNote || 'No reason given.'}
          </p>
        </Section>
      ) : (
        <>
          <Section title="Attendance">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Arrival" value={detail.arrivalTiming ?? '—'} />
              {detail.lateReason && (
                <div>
                  <p className="text-[11px] text-raasta-muted">Late reason</p>
                  <p className="text-sm text-raasta-ink">{detail.lateReason}</p>
                </div>
              )}
            </div>
          </Section>

          {!isCreator && (
            <Section title="Sales activity">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Organic calls" value={detail.organicCalls} />
                <Stat label="Marketing calls" value={detail.marketingCalls} />
                <Stat label="Connected calls" value={detail.connectedCalls} />
                <Stat label="Video calls" value={detail.videoCalls} />
                <Stat label="Face-to-face" value={detail.faceToFace} />
                <Stat label="Reels uploaded" value={detail.reelsUploaded} />
                <Stat label="Leads received" value={detail.leadsReceived} />
                <Stat label="Sales revenue" value={fmtAED(detail.salesRevenue)} />
                {detail.teamRevenue !== null && (
                  <Stat label="Team revenue" value={fmtAED(detail.teamRevenue)} />
                )}
              </div>
            </Section>
          )}

          {isCreator && cm && (
            <Section title="Creator output">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Reels given" value={cm.reelsGiven} />
                <Stat label="Viral videos" value={cm.viralVideos} />
                <Stat label="Leads generated" value={cm.leadsGenerated} />
                <Stat label="Team / Raasta videos" value={cm.instagramVideos} />
              </div>
              {cm.remarks && (
                <p className="text-sm text-raasta-ink mt-3">
                  <span className="text-raasta-muted">Remarks: </span>
                  {cm.remarks}
                </p>
              )}
            </Section>
          )}

          {isCreator && detail.creatorAgentMetrics.length > 0 && (
            <Section title="Per agent">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-raasta-muted border-b border-raasta-line">
                      <th className="font-medium py-1.5">Agent</th>
                      <th className="font-medium py-1.5 text-right">Reels</th>
                      <th className="font-medium py-1.5 text-right">Viral</th>
                      <th className="font-medium py-1.5 text-right">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.creatorAgentMetrics.map((am) => (
                      <tr key={am.id} className="border-b border-raasta-line last:border-0 align-top">
                        <td className="py-2 text-raasta-ink">
                          {am.agent?.fullName ?? am.agentId}
                          {(platformsByAgent.get(am.agentId)?.length ?? 0) > 0 && (
                            <span className="block text-[11px] text-raasta-muted mt-0.5">
                              {platformsByAgent
                                .get(am.agentId)!
                                .map((p) => `${p.platform} ${p.count}`)
                                .join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-raasta-ink">{am.reelsGiven}</td>
                        <td className="py-2 text-right tabular-nums text-raasta-ink">{am.viralVideos}</td>
                        <td className="py-2 text-right tabular-nums text-raasta-ink">
                          {am.leadsGenerated}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {detail.developerVisits.length > 0 && (
            <Section title="Developer / site visits">
              <div className="flex flex-wrap gap-1.5">
                {detail.developerVisits.map((v) => (
                  <Badge key={v.id}>{v.developerName}</Badge>
                ))}
              </div>
            </Section>
          )}

          {detail.shootParticipants.length > 0 && (
            <Section title="Shoot participants">
              <div className="flex flex-wrap gap-1.5">
                {detail.shootParticipants.map((p) => (
                  <Badge key={p.id}>{p.member?.fullName ?? p.memberId}</Badge>
                ))}
              </div>
            </Section>
          )}

          {detail.extraWorkRecords.length > 0 && (
            <Section title="Extra work">
              <ul className="space-y-2">
                {detail.extraWorkRecords.map((ew) => (
                  <li key={ew.id} className="text-sm">
                    <span className="text-raasta-ink font-medium">{ew.workType}</span>
                    <span className="text-raasta-muted"> × {ew.quantity}</span>
                    {ew.explanation && (
                      <span className="block text-xs text-raasta-muted">{ew.explanation}</span>
                    )}
                    {ew.link && (
                      <a
                        href={ew.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gold-600 hover:text-gold-700 underline break-all"
                      >
                        {ew.link}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(detail.learnedToday || detail.issuesToday) && (
            <Section title="Notes">
              {detail.learnedToday && (
                <p className="text-sm text-raasta-ink">
                  <span className="text-raasta-muted">Learned: </span>
                  {detail.learnedToday}
                </p>
              )}
              {detail.issuesToday && (
                <p className="text-sm text-raasta-ink mt-1.5">
                  <span className="text-raasta-muted">Issues: </span>
                  {detail.issuesToday}
                </p>
              )}
            </Section>
          )}
        </>
      )}
    </Card>
  );
}
