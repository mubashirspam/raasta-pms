'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle, CardHint } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  submitSalesTarget,
  submitCreatorTarget,
  addCreatorTeamAgent,
  removeCreatorTeamAgent,
} from '@/lib/actions/targets';
import { fmtAED, MONTHS } from '@/lib/domain/helpers';
import type { TeamMember, OperationalWeek, Position, EmployeeCategory } from '@/db/schema';
import { ArrowLeft, Lock, CheckCircle2, Plus, Trash2 } from 'lucide-react';

type MemberWithRelations = TeamMember & { category: EmployeeCategory; position: Position };
type TargetRow = { weekId: number; agentId: string | null } & Record<string, unknown>;

interface Props {
  member: MemberWithRelations;
  weeks: OperationalWeek[];
  month: number;
  year: number;
  salesAgents: MemberWithRelations[];
  myTeam: MemberWithRelations[];
  submitted: TargetRow[];
}

type Step = 'week' | 'form' | 'review' | 'receipt';

const EMPTY_AGENT = {
  reelsTarget: '0',
  viralVideosTarget: '0',
  leadsTarget: '0',
  picsTarget: '0',
};
type AgentTargets = Record<string, typeof EMPTY_AGENT>;

export function TargetsClient({
  member,
  weeks,
  month,
  year,
  salesAgents,
  myTeam,
  submitted,
}: Props) {
  const router = useRouter();
  const isCreator = member.category.name === 'Content Creator';
  const isLerBdm = !isCreator && ['LER', 'BDM'].includes(member.position.name);

  const [step, setStep] = useState<Step>('week');
  const [selectedWeek, setSelectedWeek] = useState<OperationalWeek | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [agentTargets, setAgentTargets] = useState<AgentTargets>({});
  const [addingAgentId, setAddingAgentId] = useState('');
  const [rosterBusy, setRosterBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');

  // A week is locked once anything has been submitted for it.
  const lockedWeekIds = new Set(submitted.map((t) => t.weekId));

  const teamIds = new Set(myTeam.map((a) => a.id));
  const addableAgents = salesAgents.filter((a) => !teamIds.has(a.id));

  const field = (k: string, d: number | string = 0) => formData[k] ?? d;
  const setField = (k: string, v: string | number) =>
    setFormData((p) => ({ ...p, [k]: v }));

  const agentField = (id: string, k: keyof typeof EMPTY_AGENT) =>
    agentTargets[id]?.[k] ?? '0';
  const setAgentField = (id: string, k: keyof typeof EMPTY_AGENT, v: string) =>
    setAgentTargets((p) => ({ ...p, [id]: { ...EMPTY_AGENT, ...p[id], [k]: v } }));

  async function handleAddAgent() {
    if (!addingAgentId) return;
    setRosterBusy(true);
    const r = await addCreatorTeamAgent({ creatorId: member.id, agentId: addingAgentId });
    setRosterBusy(false);
    if (!r.success) return toast.error(r.error ?? 'Could not add agent');
    setAddingAgentId('');
    router.refresh();
  }

  async function handleRemoveAgent(agentId: string) {
    setRosterBusy(true);
    await removeCreatorTeamAgent(member.id, agentId);
    setRosterBusy(false);
    setAgentTargets((p) => {
      const next = { ...p };
      delete next[agentId];
      return next;
    });
    router.refresh();
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = isCreator
        ? await submitCreatorTarget({
            memberId: member.id,
            weekId: selectedWeek!.id,
            teamVideosTarget: field('teamVideosTarget'),
            agentTargets: myTeam.map((a) => ({
              agentId: a.id,
              reelsTarget: agentField(a.id, 'reelsTarget'),
              viralVideosTarget: agentField(a.id, 'viralVideosTarget'),
              leadsTarget: agentField(a.id, 'leadsTarget'),
              picsTarget: agentField(a.id, 'picsTarget'),
            })),
          })
        : await submitSalesTarget({
            memberId: member.id,
            weekId: selectedWeek!.id,
            positionId: member.positionId,
            ...formData,
          });

      if (!result.success) {
        toast.error(result.error ?? 'Submission failed');
        return;
      }
      setReferenceNumber(result.referenceNumber ?? '');
      setStep('receipt');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Step: pick a week ───────────────────────────────────────────────────
  if (step === 'week') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-raasta-ink">Weekly Target</h1>
          <p className="text-sm text-raasta-muted mt-1">
            {MONTHS[month]} {year} · pick a week
          </p>
        </div>

        {weeks.length === 0 && (
          <Card>
            <p className="text-sm text-raasta-muted">
              No operational weeks exist for this month yet. Ask your admin to generate them.
            </p>
          </Card>
        )}

        <div className="space-y-2.5">
          {weeks.map((w) => {
            const locked = lockedWeekIds.has(w.id);
            return (
              <button
                key={w.id}
                onClick={() => {
                  setSelectedWeek(w);
                  setStep('form');
                }}
                className="w-full text-left bg-raasta-surface border border-raasta-border rounded-2xl p-4 shadow-card hover:shadow-lift hover:border-gold-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-raasta-ink">{w.label}</p>
                    <p className="text-xs text-raasta-muted mt-0.5">
                      {w.startDate} → {w.endDate}
                    </p>
                  </div>
                  {locked ? (
                    <Badge variant="green">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="gold">Open</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const weekLocked = selectedWeek ? lockedWeekIds.has(selectedWeek.id) : false;

  // ─── Step: form (or read-only if already submitted) ──────────────────────
  if (step === 'form') {
    if (weekLocked) {
      const rows = submitted.filter((t) => t.weekId === selectedWeek!.id);
      const creatorRow = rows.find((r) => r.agentId === null);
      const agentRows = rows.filter((r) => r.agentId !== null);

      return (
        <div className="space-y-5">
          <StepHeader title="Target submitted" subtitle={selectedWeek?.label} onBack={() => setStep('week')} />

          <Card className="bg-ok-50 border-ok-500/25">
            <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-ok-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-ok-600">This week is locked</p>
                <p className="text-xs text-raasta-muted mt-0.5">
                  Targets cannot be edited once submitted. Ask your admin if something needs
                  correcting.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-3">Your target</CardTitle>
            <div className="space-y-2 text-sm">
              {isCreator ? (
                <>
                  <Row label="Team / Raasta Page Videos" value={String(creatorRow?.teamVideosTarget ?? 0)} />
                  {agentRows.map((r) => (
                    <div key={String(r.agentId)} className="pt-2 mt-2 border-t border-raasta-line">
                      <p className="font-semibold text-raasta-ink text-sm mb-1">
                        {(r.agent as TeamMember | null)?.fullName ?? 'Agent'}
                      </p>
                      <Row label="Reels" value={String(r.reelsTarget ?? 0)} />
                      <Row label="Viral Videos (100K+ Views)" value={String(r.viralVideosTarget ?? 0)} />
                      <Row label="Leads" value={String(r.leadsTarget ?? 0)} />
                      <Row label="Pics / Carousel / Poster" value={String(r.picsTarget ?? 0)} />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <Row label="Connected Calls" value={String(creatorRow?.connectedCallsTarget ?? 0)} />
                  <Row label="Video Calls" value={String(creatorRow?.videoCallsTarget ?? 0)} />
                  <Row label="Face-to-Face" value={String(creatorRow?.faceToFaceTarget ?? 0)} />
                  <Row
                    label="Revenue Target"
                    value={fmtAED(Number(creatorRow?.revenueTarget ?? 0))}
                  />
                </>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <StepHeader title="Weekly Target" subtitle={selectedWeek?.label} onBack={() => setStep('week')} />

        <Card>
          {isCreator ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <CardTitle>Creator Target</CardTitle>
                <Input
                  label="Team / Raasta Page Videos Target"
                  type="number"
                  min="0"
                  value={String(field('teamVideosTarget'))}
                  onChange={(e) => setField('teamVideosTarget', e.target.value)}
                />
                <CardHint>Your own output for the week — not split across agents.</CardHint>
              </div>

              <div>
                <CardTitle>My Team</CardTitle>
                <CardHint>Agents you set targets for. This roster carries over week to week.</CardHint>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select
                    label="Add agent"
                    value={addingAgentId}
                    onChange={(e) => setAddingAgentId(e.target.value)}
                    placeholder={addableAgents.length ? 'Select a sales agent' : 'All agents added'}
                    options={addableAgents.map((a) => ({
                      value: a.id,
                      label: `${a.fullName} (${a.memberCode})`,
                    }))}
                  />
                </div>
                <Button type="button" onClick={handleAddAgent} loading={rosterBusy} disabled={!addingAgentId}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add
                </Button>
              </div>

              {myTeam.length === 0 && (
                <p className="text-sm text-raasta-muted">
                  No agents yet — add one above to start setting targets.
                </p>
              )}

              {myTeam.map((agent) => (
                <div key={agent.id} className="border border-raasta-border rounded-xl p-4 space-y-3 bg-raasta-subtle/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-raasta-ink">{agent.fullName}</p>
                      <p className="text-xs text-raasta-muted">
                        {agent.memberCode} · {agent.position.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAgent(agent.id)}
                      aria-label={`Remove ${agent.fullName}`}
                      className="p-1.5 rounded-lg text-raasta-faint hover:text-bad-500 hover:bg-bad-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <Input label="Reels Target" type="number" min="0"
                    value={agentField(agent.id, 'reelsTarget')}
                    onChange={(e) => setAgentField(agent.id, 'reelsTarget', e.target.value)} />
                  <Input label="Viral Videos (100K+ Views)" type="number" min="0"
                    value={agentField(agent.id, 'viralVideosTarget')}
                    onChange={(e) => setAgentField(agent.id, 'viralVideosTarget', e.target.value)} />
                  <Input label="Leads Target" type="number" min="0"
                    value={agentField(agent.id, 'leadsTarget')}
                    onChange={(e) => setAgentField(agent.id, 'leadsTarget', e.target.value)} />
                  <Input label="Pics / Carousel / Poster Target" type="number" min="0"
                    value={agentField(agent.id, 'picsTarget')}
                    onChange={(e) => setAgentField(agent.id, 'picsTarget', e.target.value)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <CardTitle>Sales Targets</CardTitle>
              <Input label="Connected Calls Target" type="number" min="0"
                value={String(field('connectedCallsTarget'))}
                onChange={(e) => setField('connectedCallsTarget', e.target.value)} />
              <Input label="Video Calls Target" type="number" min="0"
                value={String(field('videoCallsTarget'))}
                onChange={(e) => setField('videoCallsTarget', e.target.value)} />
              <Input label="Face-to-Face Target" type="number" min="0"
                value={String(field('faceToFaceTarget'))}
                onChange={(e) => setField('faceToFaceTarget', e.target.value)} />
              <Input label="Revenue Target (AED)" type="number" min="0"
                value={String(field('revenueTarget'))}
                onChange={(e) => setField('revenueTarget', e.target.value)} />
              {isLerBdm && (
                <Input label="Team Revenue Target (AED) — LER/BDM" type="number" min="0"
                  value={String(field('teamRevenueAmount'))}
                  onChange={(e) => setField('teamRevenueAmount', e.target.value)} />
              )}
            </div>
          )}
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={() => setStep('review')}
          disabled={isCreator && myTeam.length === 0}
        >
          Review
        </Button>
      </div>
    );
  }

  // ─── Step: review ────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="space-y-5">
        <StepHeader title="Review & submit" subtitle={selectedWeek?.label} onBack={() => setStep('form')} />

        <Card className="bg-warn-50 border-warn-500/25">
          <p className="text-xs text-warn-500">
            Once submitted, this target is locked and cannot be edited.
          </p>
        </Card>

        <Card>
          <div className="space-y-2 text-sm">
            <Row label="Member" value={member.fullName} />
            <Row label="Week" value={selectedWeek?.label ?? ''} />
            {isCreator ? (
              <>
                <Row label="Team / Raasta Page Videos" value={String(field('teamVideosTarget'))} />
                {myTeam.map((agent) => (
                  <div key={agent.id} className="pt-2 mt-2 border-t border-raasta-line">
                    <p className="font-semibold text-raasta-ink text-sm mb-1">{agent.fullName}</p>
                    <Row label="Reels" value={agentField(agent.id, 'reelsTarget')} />
                    <Row label="Viral Videos (100K+ Views)" value={agentField(agent.id, 'viralVideosTarget')} />
                    <Row label="Leads" value={agentField(agent.id, 'leadsTarget')} />
                    <Row label="Pics / Carousel / Poster" value={agentField(agent.id, 'picsTarget')} />
                  </div>
                ))}
              </>
            ) : (
              <>
                <Row label="Connected Calls" value={String(field('connectedCallsTarget'))} />
                <Row label="Video Calls" value={String(field('videoCallsTarget'))} />
                <Row label="Face-to-Face" value={String(field('faceToFaceTarget'))} />
                <Row label="Revenue Target" value={fmtAED(Number(field('revenueTarget')))} />
                {isLerBdm && (
                  <Row label="Team Revenue" value={fmtAED(Number(field('teamRevenueAmount')))} />
                )}
              </>
            )}
          </div>
        </Card>

        <Button className="w-full" size="lg" onClick={handleSubmit} loading={submitting}>
          Submit target
        </Button>
      </div>
    );
  }

  // ─── Step: receipt ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Card className="text-center py-8">
        <div className="w-14 h-14 bg-ok-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-ok-600" aria-hidden="true" />
        </div>
        <CardTitle>Target submitted</CardTitle>
        <p className="text-sm text-raasta-muted mt-1">{selectedWeek?.label}</p>
        {referenceNumber && (
          <p className="text-xs text-raasta-faint mt-3 font-mono">{referenceNumber}</p>
        )}
      </Card>
      <Button variant="outline" className="w-full" onClick={() => setStep('week')}>
        Back to weeks
      </Button>
    </div>
  );
}

function StepHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Go back"
        className="p-2 -ml-2 rounded-lg text-raasta-muted hover:text-raasta-ink hover:bg-raasta-subtle transition-colors"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
      </button>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-raasta-ink">{title}</h1>
        {subtitle && <p className="text-xs text-raasta-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-raasta-muted">{label}</span>
      <span className="text-raasta-ink font-medium text-right">{value}</span>
    </div>
  );
}
