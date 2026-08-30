'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DurationPicker } from '@/components/ui/DurationPicker';
import { fmtDuration } from '@/lib/domain/helpers';
import { submitSalesLog, submitCreatorLog } from '@/lib/actions/daily-log';
import { VIRAL_PLATFORMS } from '@/db/schema';
import type { TeamMember, EmployeeCategory, Position } from '@/db/schema';

type MemberWithRelations = TeamMember & {
  category: EmployeeCategory;
  position: Position;
};

type Step = 'form' | 'receipt';
type Attendance = 'present' | 'absent';

interface Props {
  member: MemberWithRelations;
  today: string;
  myTeam: MemberWithRelations[];
}

const ATTENDANCE_OPTIONS = [
  { value: 'present', label: '✅ Present' },
  { value: 'absent', label: '❌ Absent' },
];

const ARRIVAL_OPTIONS = [
  { value: 'Before 9:00 AM', label: 'Before 9:00 AM' },
  { value: '9:00 AM – 9:59 AM', label: '9:00 AM – 9:59 AM' },
  { value: 'After 9:59 AM', label: 'After 9:59 AM' },
];

export function DailyLogClient({ member, today, myTeam }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [attendance, setAttendance] = useState<Attendance>('present');
  const [absenceNote, setAbsenceNote] = useState('');
  const [arrivalTiming, setArrivalTiming] = useState('Before 9:00 AM');
  const [lateReason, setLateReason] = useState('');
  // Sales fields
  const [organicCalls, setOrganicCalls] = useState(0);
  const [marketingCalls, setMarketingCalls] = useState(0);
  // Call time is held in whole minutes; the picker splits it into h + m.
  const [organicCallMinutes, setOrganicCallMinutes] = useState(0);
  const [marketingCallMinutes, setMarketingCallMinutes] = useState(0);
  const [videoCalls, setVideoCalls] = useState(0);
  const [faceToFace, setFaceToFace] = useState(0);
  const [reelsUploaded, setReelsUploaded] = useState(0);
  const [leadsReceived, setLeadsReceived] = useState(0);
  const [salesRevenue, setSalesRevenue] = useState(0);
  const [teamRevenue, setTeamRevenue] = useState(0);
  const [learnedToday, setLearnedToday] = useState('');
  const [issuesToday, setIssuesToday] = useState('');
  const [developerVisited, setDeveloperVisited] = useState(false);
  const [developerNames, setDeveloperNames] = useState<string[]>(['']);
  // Creator fields — reels/viral/leads are logged per agent, keyed by agent id.
  const [agentMetrics, setAgentMetrics] = useState<
    Record<
      string,
      { reelsGiven: number; leadsGenerated: number; viral: Record<string, number> }
    >
  >({});
  const [instagramVideos, setInstagramVideos] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');

  const connectedCalls = organicCalls + marketingCalls;
  const totalCallMinutes = organicCallMinutes + marketingCallMinutes;
  const isAbsent = attendance === 'absent';
  // LER/BDM report their team's revenue on top of their own.
  const isCreator = member.category.name === 'Content Creator';
  const isSales = !isCreator;
  const isLerBdm = isSales && ['LER', 'BDM'].includes(member.position.name);

  // The selected creator's roster and the day's totals summed across it.

  function metric(agentId: string, key: 'reelsGiven' | 'leadsGenerated') {
    return agentMetrics[agentId]?.[key] ?? 0;
  }

  function setMetric(agentId: string, key: 'reelsGiven' | 'leadsGenerated', value: number) {
    setAgentMetrics((prev) => ({
      ...prev,
      [agentId]: {
        ...{ reelsGiven: 0, leadsGenerated: 0, viral: {} },
        ...prev[agentId],
        [key]: Math.max(0, value),
      },
    }));
  }

  function viralCount(agentId: string, platform: string) {
    return agentMetrics[agentId]?.viral?.[platform] ?? 0;
  }

  // Steppers never go below zero.
  function bumpViral(agentId: string, platform: string, delta: number) {
    setAgentMetrics((prev) => {
      const cur = prev[agentId] ?? { reelsGiven: 0, leadsGenerated: 0, viral: {} };
      const next = Math.max(0, (cur.viral?.[platform] ?? 0) + delta);
      return {
        ...prev,
        [agentId]: { ...cur, viral: { ...cur.viral, [platform]: next } },
      };
    });
  }

  function agentViralTotal(agentId: string) {
    return VIRAL_PLATFORMS.reduce((s, pl) => s + viralCount(agentId, pl), 0);
  }

  const totalReels = myTeam.reduce((s, a) => s + metric(a.id, 'reelsGiven'), 0);
  const totalViral = myTeam.reduce((s, a) => s + agentViralTotal(a.id), 0);
  const totalLeads = myTeam.reduce((s, a) => s + metric(a.id, 'leadsGenerated'), 0);

  // Detail rows must match the summed totals, so resize as the per-agent
  // numbers change rather than off a single input's onChange.
  // ─── Form ─────────────────────────────────────────────────────────────────
  if (step === 'form') {

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);

      try {
        let result;
        if (isSales) {
          result = await submitSalesLog({
            memberId: member.id,
            logDate: today,
            attendance,
            absenceNote: absenceNote || undefined,
            arrivalTiming: isAbsent ? undefined : (arrivalTiming as 'Before 9:00 AM' | '9:00 AM – 9:59 AM' | 'After 9:59 AM'),
            lateReason: lateReason || undefined,
            organicCalls,
            marketingCalls,
            organicCallMinutes,
            marketingCallMinutes,
            videoCalls,
            faceToFace,
            reelsUploaded,
            leadsReceived,
            salesRevenue,
            teamRevenue: isLerBdm ? teamRevenue : undefined,
            learnedToday: learnedToday || undefined,
            issuesToday: issuesToday || undefined,
            developerVisited,
            developerNames: developerVisited ? developerNames.filter(Boolean) : [],
          });
        } else {
          result = await submitCreatorLog({
            memberId: member.id,
            logDate: today,
            attendance,
            absenceNote: absenceNote || undefined,
            arrivalTiming: isAbsent ? undefined : (arrivalTiming as 'Before 9:00 AM' | '9:00 AM – 9:59 AM' | 'After 9:59 AM'),
            lateReason: lateReason || undefined,
            agentMetrics: myTeam.map((a) => ({
              agentId: a.id,
              reelsGiven: metric(a.id, 'reelsGiven'),
              leadsGenerated: metric(a.id, 'leadsGenerated'),
              viralPlatforms: VIRAL_PLATFORMS.filter((pl) => viralCount(a.id, pl) > 0).map((pl) => ({
                platform: pl,
                count: viralCount(a.id, pl),
              })),
            })),
            instagramVideos,
            remarks: remarks || undefined,
            shootParticipantIds: [],
          });
        }

        if (!result.success) {
          toast.error(result.error ?? 'Submission failed');
        } else {
          setReferenceNumber(result.referenceNumber ?? '');
          setStep('receipt');
        }
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-raasta-ink">Daily Log</h1>
            <p className="text-sm text-raasta-muted mt-1">
              {member.fullName} · {today}
            </p>
          </div>
        </div>

        {/* Attendance */}
        <Card>
          <CardTitle className="mb-3">Attendance</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {ATTENDANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAttendance(opt.value as Attendance)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  attendance === opt.value
                    ? 'bg-gold-400 text-raasta-ink'
                    : 'bg-raasta-subtle border border-raasta-border text-raasta-muted hover:text-raasta-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isAbsent && (
            <div className="mt-3">
              <Input
                label="Absence Note"
                value={absenceNote}
                onChange={(e) => setAbsenceNote(e.target.value)}
                placeholder="Reason for absence"
              />
            </div>
          )}
        </Card>

        {!isAbsent && (
          <>
            {/* Arrival timing */}
            <Card>
              <CardTitle className="mb-3">Arrival Timing</CardTitle>
              <Select
                options={ARRIVAL_OPTIONS}
                value={arrivalTiming}
                onChange={(e) => setArrivalTiming(e.target.value)}
              />
              {arrivalTiming === 'After 9:59 AM' && (
                <div className="mt-3">
                  <Input
                    label="Reason for being late *"
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    required
                    placeholder="Explain why you were late"
                  />
                </div>
              )}
            </Card>

            {/* Sales-specific */}
            {isSales && (
              <>
                <Card>
                  <CardTitle className="mb-3">Call Activity</CardTitle>
                  <div className="space-y-3">
                    <Input label="Organic Calls" type="number" min="0"
                      value={organicCalls} onChange={(e) => setOrganicCalls(+e.target.value)} />
                    <DurationPicker
                      label="Time on Organic Calls"
                      value={organicCallMinutes}
                      onChange={setOrganicCallMinutes}
                    />

                    <div className="h-px bg-raasta-line" />

                    <Input label="Marketing / Reassigned Calls" type="number" min="0"
                      value={marketingCalls} onChange={(e) => setMarketingCalls(+e.target.value)} />
                    <DurationPicker
                      label="Time on Reassigned Calls"
                      value={marketingCallMinutes}
                      onChange={setMarketingCallMinutes}
                    />

                    <div className="bg-raasta-subtle rounded-lg px-3 py-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-raasta-muted">Connected Calls (auto)</span>
                        <span className="text-gold-600 font-semibold">{connectedCalls}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-raasta-muted">Total Call Time (auto)</span>
                        <span className="text-gold-600 font-semibold">
                          {fmtDuration(totalCallMinutes)}
                        </span>
                      </div>
                    </div>
                    <Input label="Video Calls" type="number" min="0"
                      value={videoCalls} onChange={(e) => setVideoCalls(+e.target.value)} />
                    <Input label="Face-to-Face Meetings" type="number" min="0"
                      value={faceToFace} onChange={(e) => setFaceToFace(+e.target.value)} />
                  </div>
                </Card>

                <Card>
                  <CardTitle className="mb-3">Sales Performance</CardTitle>
                  <div className="space-y-3">
                    <Input label="Reels Uploaded" type="number" min="0"
                      value={reelsUploaded} onChange={(e) => setReelsUploaded(+e.target.value)} />
                    <Input label="Leads Received" type="number" min="0"
                      value={leadsReceived} onChange={(e) => setLeadsReceived(+e.target.value)} />
                    <Input label="Sales Revenue (AED)" type="number" min="0" step="0.01"
                      value={salesRevenue} onChange={(e) => setSalesRevenue(+e.target.value)} />
                    {isLerBdm && (
                      <Input label="Team Revenue (AED) — LER/BDM" type="number" min="0" step="0.01"
                        value={teamRevenue} onChange={(e) => setTeamRevenue(+e.target.value)} />
                    )}
                  </div>
                </Card>

                <Card>
                  <CardTitle className="mb-3">Developer / Site Visit</CardTitle>
                  <div className="flex gap-3 mb-3">
                    {['Yes', 'No'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDeveloperVisited(v === 'Yes')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          developerVisited === (v === 'Yes')
                            ? 'bg-gold-400 text-raasta-ink'
                            : 'bg-raasta-subtle border border-raasta-border text-raasta-muted'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {developerVisited && (
                    <div className="space-y-2">
                      {developerNames.map((name, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            placeholder={`Developer / site ${i + 1} name`}
                            value={name}
                            onChange={(e) => {
                              const updated = [...developerNames];
                              updated[i] = e.target.value;
                              setDeveloperNames(updated);
                            }}
                            className="flex-1"
                          />
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => setDeveloperNames((d) => d.filter((_, j) => j !== i))}
                              className="text-bad-500 hover:text-bad-600 px-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeveloperNames((d) => [...d, ''])}
                      >
                        + Add Developer / Site
                      </Button>
                    </div>
                  )}
                </Card>

                <Card>
                  <CardTitle className="mb-3">Reflections</CardTitle>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-raasta-muted uppercase tracking-wide">
                        What did you learn today? (max 150 chars)
                      </label>
                      <textarea
                        className="w-full bg-raasta-subtle border border-raasta-border rounded-xl px-3 py-2.5 text-raasta-ink text-sm resize-none focus:outline-none focus:border-gold-400"
                        rows={2}
                        maxLength={150}
                        value={learnedToday}
                        onChange={(e) => setLearnedToday(e.target.value)}
                      />
                      <p className="text-xs text-raasta-faint text-right">{learnedToday.length}/150</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-raasta-muted uppercase tracking-wide">
                        Issues Today (max 250 chars)
                      </label>
                      <textarea
                        className="w-full bg-raasta-subtle border border-raasta-border rounded-xl px-3 py-2.5 text-raasta-ink text-sm resize-none focus:outline-none focus:border-gold-400"
                        rows={2}
                        maxLength={250}
                        value={issuesToday}
                        onChange={(e) => setIssuesToday(e.target.value)}
                      />
                      <p className="text-xs text-raasta-faint text-right">{issuesToday.length}/250</p>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* Creator-specific */}
            {!isSales && (
              <>
                <Card>
                  <CardTitle className="mb-3">Creator KPIs</CardTitle>
                  <div className="space-y-3">
                    {myTeam.length === 0 ? (
                      <p className="text-sm text-raasta-muted">
                        No agents on your team yet — add them on the Targets page first.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-raasta-muted font-medium">Per agent</p>
                        {myTeam.map((agent) => (
                          <div key={agent.id} className="bg-raasta-subtle rounded-lg p-3 space-y-2 border border-raasta-border">
                            <p className="text-raasta-ink font-semibold text-sm">{agent.fullName}</p>
                            <p className="text-xs text-raasta-muted">{agent.memberCode} · {agent.position.name}</p>
                            <Input label="Reels Given" type="number" min="0"
                              value={metric(agent.id, 'reelsGiven')}
                              onChange={(e) => setMetric(agent.id, 'reelsGiven', +e.target.value)} />
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <label className="text-xs text-raasta-muted font-medium">
                                  Video Got Viral (100k+ views)
                                </label>
                                <span className="text-xs text-raasta-ink font-semibold">
                                  {agentViralTotal(agent.id)}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {VIRAL_PLATFORMS.map((pl) => {
                                  const n = viralCount(agent.id, pl);
                                  return (
                                    <div key={pl} className="flex items-center justify-between gap-2">
                                      <span className={`text-xs ${n > 0 ? 'text-raasta-ink' : 'text-raasta-muted'}`}>
                                        {pl}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          aria-label={`Remove one ${pl} viral video`}
                                          onClick={() => bumpViral(agent.id, pl, -1)}
                                          disabled={n === 0}
                                          className="w-7 h-7 rounded-md border border-raasta-border text-raasta-muted hover:text-raasta-ink hover:border-gold-400 disabled:opacity-30 disabled:hover:text-raasta-muted disabled:hover:border-raasta-border transition-colors"
                                        >
                                          −
                                        </button>
                                        <span className={`w-6 text-center text-sm tabular-nums ${n > 0 ? 'text-raasta-ink font-semibold' : 'text-raasta-faint'}`}>
                                          {n}
                                        </span>
                                        <button
                                          type="button"
                                          aria-label={`Add one ${pl} viral video`}
                                          onClick={() => bumpViral(agent.id, pl, 1)}
                                          className="w-7 h-7 rounded-md border border-raasta-border text-raasta-muted hover:text-raasta-ink hover:border-gold-400 transition-colors"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <Input label="Leads Generated" type="number" min="0"
                              value={metric(agent.id, 'leadsGenerated')}
                              onChange={(e) => setMetric(agent.id, 'leadsGenerated', +e.target.value)} />
                          </div>
                        ))}
                        <div className="flex gap-4 text-xs text-raasta-muted pt-1">
                          <span>Reels: <span className="text-raasta-ink font-medium">{totalReels}</span></span>
                          <span>Viral: <span className="text-raasta-ink font-medium">{totalViral}</span></span>
                          <span>Leads: <span className="text-raasta-ink font-medium">{totalLeads}</span></span>
                        </div>
                      </div>
                    )}
                    <div>
                      <Input label="Team / Raasta Videos Given" type="number" min="0"
                        value={instagramVideos}
                        onChange={(e) => setInstagramVideos(+e.target.value)} />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-raasta-muted uppercase tracking-wide">
                      Remarks (max 500 chars)
                    </label>
                    <textarea
                      className="w-full bg-raasta-subtle border border-raasta-border rounded-xl px-3 py-2.5 text-raasta-ink text-sm resize-none focus:outline-none focus:border-gold-400"
                      rows={3}
                      maxLength={500}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                    <p className="text-xs text-raasta-faint text-right">{remarks.length}/500</p>
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        <Button type="submit" className="w-full" loading={submitting}>
          Submit Daily Log
        </Button>
      </form>
    );
  }

  // ─── Receipt ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="text-center">
        <div className="w-14 h-14 bg-ok-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-ok-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <CardTitle>Log Submitted!</CardTitle>
        <p className="text-sm text-raasta-muted mt-1">{today} — {member.fullName}</p>
        <div className="mt-4 bg-raasta-subtle rounded-lg px-4 py-3">
          <p className="text-xs text-raasta-muted mb-1">Reference Number</p>
          <p className="text-gold-600 font-mono font-bold text-lg">{referenceNumber}</p>
        </div>
      </Card>
      <Button variant="outline" className="w-full"
        onClick={() => setStep('form')}>
        Submit Another Log
      </Button>
    </div>
  );
}

