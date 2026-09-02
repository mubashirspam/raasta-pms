'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle, CardHint } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { MonthStrip } from '@/components/ui/MonthStrip';
import { cn, fmtAED, MONTHS } from '@/lib/domain/helpers';
import {
  updateSalesTargetAsAdmin,
  updateCreatorTargetAsAdmin,
  type TargetDetail,
  type TargetDetailRow,
  type WeekTargetState,
  type WeekTargetSummary,
} from '@/lib/actions/team-targets';
import type { TeamMember, EmployeeCategory, Position } from '@/db/schema';
import {
  Search,
  Pencil,
  Lock,
  AlertTriangle,
  Target,
  Plus,
  Trash2,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

type MemberWithRelations = TeamMember & { category: EmployeeCategory; position: Position };

interface Props {
  members: MemberWithRelations[];
  memberId: string | null;
  month: number;
  year: number;
  /** Today's month/year in Dubai — anchors the month strip. */
  currentMonth: number;
  currentYear: number;
  calendar: WeekTargetSummary[];
  detail: TargetDetail | null;
  selectedWeekId: number | null;
  counts: Record<string, { weeksSet: number; edited: number }>;
  /** The selected creator's roster, so the add-agent picker can say who is on it. */
  rosterAgentIds: string[];
}

// ─── Field maps ────────────────────────────────────────────────────────────────
// One list per target shape, so the read-only view, the edit form and the
// payload builder can never drift out of step.

interface FieldSpec {
  key: string;
  label: string;
  money?: boolean;
}

const SALES_FIELDS: FieldSpec[] = [
  { key: 'connectedCallsTarget', label: 'Connected Calls' },
  { key: 'videoCallsTarget', label: 'Video Calls' },
  { key: 'faceToFaceTarget', label: 'Face-to-Face' },
  { key: 'revenueTarget', label: 'Revenue Target', money: true },
  { key: 'reelsUploadedTarget', label: 'Reels Uploaded' },
  { key: 'selfieVideosTarget', label: 'Selfie Videos' },
];

const CREATOR_FIELDS: FieldSpec[] = [
  { key: 'teamVideosTarget', label: 'Team / Raasta Page Videos' },
];

const AGENT_FIELDS: FieldSpec[] = [
  { key: 'reelsTarget', label: 'Reels' },
  { key: 'viralVideosTarget', label: 'Viral Videos (100K+ Views)' },
  { key: 'leadsTarget', label: 'Leads' },
  { key: 'picsTarget', label: 'Pics / Carousel / Poster' },
  { key: 'longFormTarget', label: 'Long Form Videos' },
];

const STATE_BADGE: Record<WeekTargetState, { variant: 'green' | 'red' | 'gray'; label: string }> = {
  submitted: { variant: 'green', label: 'Target set' },
  missing: { variant: 'red', label: 'Not set' },
  upcoming: { variant: 'gray', label: 'Upcoming' },
};

/** A draft key: which row, which field. Agents being added key on `new:<id>`. */
const dk = (targetId: number | string, field: string) => `${targetId}:${field}`;

/** The draft key prefix for an agent the admin is adding to the week. */
const newRowId = (agentId: string) => `new:${agentId}`;

/** A stored target value as an edit-box string; nulls read as 0. */
const asText = (v: unknown) => (v == null ? '0' : String(Number(v)));

/** An emptied box counts as zero, matching the member's own target form. */
const n0 = (v: string | undefined) => (v === '' || v == null ? 0 : Number(v));

function fieldsFor(row: TargetDetailRow, isCreator: boolean): FieldSpec[] {
  if (!isCreator) return SALES_FIELDS;
  return row.agentId === null ? CREATOR_FIELDS : AGENT_FIELDS;
}

export function TeamTargetsClient({
  members,
  memberId,
  month,
  year,
  currentMonth,
  currentYear,
  calendar,
  detail,
  selectedWeekId,
  counts,
  rosterAgentIds,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // Agent rows marked for removal, and agents being added to the week. Both are
  // held until Save, so a stray click changes nothing the member committed to.
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [addedAgentIds, setAddedAgentIds] = useState<string[]>([]);
  const [addingAgentId, setAddingAgentId] = useState('');

  const selectedMember = members.find((m) => m.id === memberId) ?? null;
  const isCreator = selectedMember?.category.name === 'Content Creator';
  const selectedWeek = calendar.find((w) => w.week.id === selectedWeekId) ?? null;

  // The values as submitted, against which every edit is diffed.
  const baseline = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of detail ?? []) {
      for (const f of fieldsFor(row, isCreator)) {
        out[dk(row.id, f.key)] = asText((row as Record<string, unknown>)[f.key]);
      }
    }
    return out;
  }, [detail, isCreator]);

  // Reset the form whenever the underlying target changes — a different week,
  // a different member, or the refresh that follows a save.
  const baselineKey = useMemo(() => JSON.stringify(baseline), [baseline]);
  useEffect(() => {
    setDraft(JSON.parse(baselineKey) as Record<string, string>);
    setEditing(false);
    setReason('');
    setRemovedIds([]);
    setAddedAgentIds([]);
    setAddingAgentId('');
  }, [baselineKey]);

  const changedKeys = useMemo(() => {
    const changed = new Set<string>();
    // A row being removed is not also a row being edited.
    const removed = new Set(removedIds.map(String));
    for (const key of Object.keys(baseline)) {
      if (removed.has(key.split(':')[0])) continue;
      if (n0(draft[key]) !== Number(baseline[key])) changed.add(key);
    }
    return changed;
  }, [draft, baseline, removedIds]);

  const dirty = changedKeys.size > 0 || removedIds.length > 0 || addedAgentIds.length > 0;

  // Agents already carrying a row this week cannot be added again.
  const targetedAgentIds = useMemo(
    () => new Set((detail ?? []).filter((r) => r.agentId).map((r) => r.agentId!)),
    [detail],
  );

  const addedAgents = useMemo(
    () =>
      addedAgentIds
        .map((id) => members.find((m) => m.id === id))
        .filter((m): m is MemberWithRelations => !!m),
    [addedAgentIds, members],
  );

  // Sales agents with no row in this week: the creator's own roster first, then
  // anyone else — picking one of those puts them on the roster as well.
  const addableAgents = useMemo(() => {
    if (!isCreator) return [];
    const roster = new Set(rosterAgentIds);
    return members
      .filter(
        (m) =>
          m.isActive &&
          m.category.name === 'Sales Agent' &&
          m.id !== memberId &&
          !targetedAgentIds.has(m.id) &&
          !addedAgentIds.includes(m.id),
      )
      .sort(
        (a, b) =>
          Number(roster.has(b.id)) - Number(roster.has(a.id)) ||
          a.fullName.localeCompare(b.fullName),
      )
      .map((m) => ({
        value: m.id,
        label: `${m.fullName} (${m.memberCode})${roster.has(m.id) ? '' : ' · not on the team'}`,
      }));
  }, [isCreator, members, memberId, rosterAgentIds, targetedAgentIds, addedAgentIds]);

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

  const go = useCallback(
    (params: Record<string, string | number | null | undefined>) => {
      if (
        editing &&
        dirty &&
        !window.confirm('Discard the unsaved changes to this target?')
      ) {
        return;
      }
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      }
      router.push(`/team-targets?${qs.toString()}`);
    },
    [editing, dirty, router],
  );

  const cancelEdit = useCallback(() => {
    setDraft(JSON.parse(baselineKey) as Record<string, string>);
    setReason('');
    setEditing(false);
    setRemovedIds([]);
    setAddedAgentIds([]);
    setAddingAgentId('');
  }, [baselineKey]);

  // Adding an agent seeds their five boxes at zero, so the block reads the same
  // as every other agent block and an untouched add still writes a real target.
  const addAgent = useCallback((agentId: string) => {
    if (!agentId) return;
    setAddedAgentIds((p) => (p.includes(agentId) ? p : [...p, agentId]));
    setDraft((p) => ({
      ...p,
      ...Object.fromEntries(AGENT_FIELDS.map((f) => [dk(newRowId(agentId), f.key), '0'])),
    }));
    setAddingAgentId('');
  }, []);

  const discardNewAgent = useCallback((agentId: string) => {
    setAddedAgentIds((p) => p.filter((id) => id !== agentId));
    setDraft((p) => {
      const next = { ...p };
      for (const f of AGENT_FIELDS) delete next[dk(newRowId(agentId), f.key)];
      return next;
    });
  }, []);

  const toggleRemoveRow = useCallback((targetId: number) => {
    setRemovedIds((p) =>
      p.includes(targetId) ? p.filter((id) => id !== targetId) : [...p, targetId],
    );
  }, []);

  // Escape backs out of an edit, the way it closes any other transient state.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) cancelEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, saving, cancelEdit]);

  // Warn on tab close / reload while an edit is in flight.
  useEffect(() => {
    if (!editing || !dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editing, dirty]);

  async function handleSave() {
    if (!detail || !selectedWeek || !memberId) return;

    setSaving(true);
    try {
      const trimmedReason = reason.trim();
      let result: { success: boolean; error?: string; unchanged?: boolean };

      if (isCreator) {
        const creatorRowData = detail.find((r) => r.agentId === null) ?? null;
        const keptAgentRows = detail.filter(
          (r) => r.agentId !== null && !removedIds.includes(r.id),
        );
        // The server refuses this too; catching it here keeps the admin from
        // losing a typed-out edit to a rejected save.
        if (keptAgentRows.length + addedAgentIds.length === 0) {
          toast.error('A creator target must keep at least one agent.');
          return;
        }
        result = await updateCreatorTargetAsAdmin({
          memberId,
          weekId: selectedWeek.week.id,
          reason: trimmedReason || undefined,
          creatorRow: creatorRowData
            ? {
                targetId: creatorRowData.id,
                teamVideosTarget: n0(draft[dk(creatorRowData.id, 'teamVideosTarget')]),
              }
            : null,
          agentRows: keptAgentRows.map((r) => ({
            targetId: r.id,
            reelsTarget: n0(draft[dk(r.id, 'reelsTarget')]),
            viralVideosTarget: n0(draft[dk(r.id, 'viralVideosTarget')]),
            leadsTarget: n0(draft[dk(r.id, 'leadsTarget')]),
            picsTarget: n0(draft[dk(r.id, 'picsTarget')]),
            longFormTarget: n0(draft[dk(r.id, 'longFormTarget')]),
          })),
          newAgentRows: addedAgentIds.map((agentId) => ({
            agentId,
            reelsTarget: n0(draft[dk(newRowId(agentId), 'reelsTarget')]),
            viralVideosTarget: n0(draft[dk(newRowId(agentId), 'viralVideosTarget')]),
            leadsTarget: n0(draft[dk(newRowId(agentId), 'leadsTarget')]),
            picsTarget: n0(draft[dk(newRowId(agentId), 'picsTarget')]),
            longFormTarget: n0(draft[dk(newRowId(agentId), 'longFormTarget')]),
          })),
          removedTargetIds: removedIds,
        });
      } else {
        const row = detail[0];
        result = await updateSalesTargetAsAdmin({
          targetId: row.id,
          reason: trimmedReason || undefined,
          connectedCallsTarget: n0(draft[dk(row.id, 'connectedCallsTarget')]),
          videoCallsTarget: n0(draft[dk(row.id, 'videoCallsTarget')]),
          faceToFaceTarget: n0(draft[dk(row.id, 'faceToFaceTarget')]),
          revenueTarget: n0(draft[dk(row.id, 'revenueTarget')]),
          reelsUploadedTarget: n0(draft[dk(row.id, 'reelsUploadedTarget')]),
          selfieVideosTarget: n0(draft[dk(row.id, 'selfieVideosTarget')]),
        });
      }

      if (!result.success) {
        toast.error(result.error ?? 'Could not save the target');
        return;
      }

      toast.success(result.unchanged ? 'Nothing had changed' : 'Target updated');
      setEditing(false);
      setReason('');
      setRemovedIds([]);
      setAddedAgentIds([]);
      setAddingAgentId('');
      router.refresh();
    } catch {
      toast.error('Could not save the target. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const weeksSet = calendar.filter((w) => w.state === 'submitted').length;
  const weeksMissing = calendar.filter((w) => w.state === 'missing').length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-raasta-ink">Targets</h1>
        <p className="text-sm text-raasta-muted">
          Pick a team member, then a week, to read the target they committed to — and correct it
          if it went in wrong.
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
                    {` · ${c?.weeksSet ?? 0}/${calendar.length || 4} weeks`}
                    {c?.edited ? ' · edited' : ''}
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
          <MonthStrip
            currentMonth={currentMonth}
            currentYear={currentYear}
            month={month}
            year={year}
            onSelect={(m, y) => go({ memberId, month: m, year: y })}
          />

          {/* ── 3. Which week ────────────────────────────────────────────────── */}
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
                  <span className="text-raasta-ink font-semibold tabular-nums">{weeksSet}</span> set
                </span>
                <span>
                  <span className="text-raasta-ink font-semibold tabular-nums">{weeksMissing}</span>{' '}
                  missed
                </span>
              </div>
            </div>

            {calendar.length === 0 ? (
              <p className="text-sm text-raasta-muted">
                No operational weeks exist for this month yet.
              </p>
            ) : (
              <div className="space-y-2">
                {calendar.map((w) => {
                  const badge = STATE_BADGE[w.state];
                  const selected = w.week.id === selectedWeekId;
                  return (
                    <button
                      key={w.week.id}
                      type="button"
                      onClick={() => go({ memberId, month, year, weekId: w.week.id })}
                      aria-current={selected ? 'true' : undefined}
                      className={cn(
                        'w-full text-left rounded-xl border px-3.5 py-3 transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                        selected
                          ? 'bg-gold-50 border-gold-300'
                          : 'bg-raasta-surface border-raasta-border hover:border-raasta-faint/40',
                        w.state === 'missing' && !selected && 'border-dashed',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-raasta-ink">
                            Week {w.week.weekNumber}
                          </p>
                          <p className="text-[11px] text-raasta-muted mt-0.5">
                            {w.week.startDate} → {w.week.endDate}
                            {w.rowCount > 1 && ` · ${w.rowCount} rows`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {w.edited && <Badge variant="amber">Edited</Badge>}
                          {w.positionFlagged && <Badge variant="amber">Position</Badge>}
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── 4. The target ────────────────────────────────────────────────── */}
          {selectedWeek ? (
            detail ? (
              <TargetDetailCard
                detail={detail}
                week={selectedWeek}
                isCreator={!!isCreator}
                editing={editing}
                draft={draft}
                changedKeys={changedKeys}
                dirty={dirty}
                reason={reason}
                saving={saving}
                removedIds={removedIds}
                addedAgents={addedAgents}
                addableAgents={addableAgents}
                addingAgentId={addingAgentId}
                onStartEdit={() => setEditing(true)}
                onCancel={cancelEdit}
                onSave={handleSave}
                onReasonChange={setReason}
                onFieldChange={(key, value) => setDraft((p) => ({ ...p, [key]: value }))}
                onAddingAgentChange={setAddingAgentId}
                onAddAgent={addAgent}
                onDiscardNewAgent={discardNewAgent}
                onToggleRemoveRow={toggleRemoveRow}
              />
            ) : (
              <Card>
                <div className="flex items-start gap-2 text-raasta-muted text-sm">
                  <Target className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    {selectedMember.fullName} set no target for Week {selectedWeek.week.weekNumber}.
                    A target can only be corrected once the member has submitted one.
                  </span>
                </div>
              </Card>
            )
          ) : (
            <Card>
              <p className="text-sm text-raasta-muted">Select a week above to read that target.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Detail rendering ──────────────────────────────────────────────────────────

interface DetailProps {
  detail: TargetDetail;
  week: WeekTargetSummary;
  isCreator: boolean;
  editing: boolean;
  draft: Record<string, string>;
  changedKeys: Set<string>;
  dirty: boolean;
  reason: string;
  saving: boolean;
  /** Agent rows the admin has marked for removal — struck through until saved. */
  removedIds: number[];
  addedAgents: MemberWithRelations[];
  addableAgents: { value: string; label: string }[];
  addingAgentId: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReasonChange: (v: string) => void;
  onFieldChange: (key: string, value: string) => void;
  onAddingAgentChange: (v: string) => void;
  onAddAgent: (agentId: string) => void;
  onDiscardNewAgent: (agentId: string) => void;
  onToggleRemoveRow: (targetId: number) => void;
}

function TargetDetailCard({
  detail,
  week,
  isCreator,
  editing,
  draft,
  changedKeys,
  dirty,
  reason,
  saving,
  removedIds,
  addedAgents,
  addableAgents,
  addingAgentId,
  onStartEdit,
  onCancel,
  onSave,
  onReasonChange,
  onFieldChange,
  onAddingAgentChange,
  onAddAgent,
  onDiscardNewAgent,
  onToggleRemoveRow,
}: DetailProps) {
  const first = detail[0];
  const creatorRow = detail.find((r) => r.agentId === null) ?? null;
  // Rows come back in row-id order, which is meaningless to read. Agents are
  // listed by name so the same creator's week always looks the same.
  const agentRows = detail
    .filter((r) => r.agentId !== null)
    .sort((a, b) => (a.agent?.fullName ?? '').localeCompare(b.agent?.fullName ?? ''));
  // The most recent override across the week's rows; a creator's rows are all
  // stamped together, so this is the whole edit history the card needs to show.
  const lastEdit = detail
    .filter((r) => r.editedAt)
    .sort((a, b) => (a.editedAt! < b.editedAt! ? 1 : -1))[0];

  // What Save is about to do, in the same words the member's notification uses.
  const editSummary = (() => {
    const parts: string[] = [];
    if (changedKeys.size) {
      parts.push(`${changedKeys.size} value${changedKeys.size === 1 ? '' : 's'} changed`);
    }
    if (addedAgents.length) {
      parts.push(`${addedAgents.length} agent${addedAgents.length === 1 ? '' : 's'} added`);
    }
    if (removedIds.length) {
      parts.push(`${removedIds.length} agent${removedIds.length === 1 ? '' : 's'} removed`);
    }
    return parts.length ? parts.join(' · ') : 'No changes yet';
  })();

  const renderField = (row: TargetDetailRow, f: FieldSpec) => {
    const key = dk(row.id, f.key);
    if (!editing) {
      const raw = (row as Record<string, unknown>)[f.key];
      return (
        <Row
          key={key}
          label={f.label}
          value={f.money ? fmtAED(Number(raw ?? 0)) : String(Number(raw ?? 0))}
        />
      );
    }
    return (
      <NumberField
        key={key}
        label={f.label}
        value={draft[key] ?? ''}
        money={f.money}
        changed={changedKeys.has(key)}
        disabled={saving}
        onChange={(v) => onFieldChange(key, v)}
      />
    );
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{first.week.label}</CardTitle>
          <p className="text-xs text-raasta-muted mt-0.5 truncate">
            {first.member.fullName} · {first.member.position.name}
          </p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={onStartEdit} className="shrink-0">
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>

      <p className="text-[11px] text-raasta-faint mt-2">
        Ref {first.referenceNumber} · submitted{' '}
        {new Date(first.submittedAt).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}
      </p>

      {lastEdit?.editedAt && (
        <p className="text-[11px] text-warn-500 mt-1">
          Edited by {lastEdit.editedBy ?? 'admin'} on{' '}
          {new Date(lastEdit.editedAt).toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}
          {lastEdit.editReason ? ` — ${lastEdit.editReason}` : ''}
        </p>
      )}

      {week.positionFlagged && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn-500/25 bg-warn-50 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-warn-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-warn-500">
            This target was filed under a position that did not match the member&apos;s record.
          </p>
        </div>
      )}

      {editing && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2">
          <Lock className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-raasta-muted">
            You are overwriting a locked target. The member is notified of the change and the old
            values are kept in the audit log.
          </p>
        </div>
      )}

      {/* Sales target — a single row of numbers. */}
      {!isCreator && (
        <Section title="Sales targets">
          <div className={editing ? 'grid gap-3 sm:grid-cols-2' : 'space-y-1 text-sm'}>
            {SALES_FIELDS.map((f) => renderField(first, f))}
          </div>
        </Section>
      )}

      {/* Creator target — own output, then one block per agent. */}
      {isCreator && (
        <>
          <Section title="Creator output">
            {creatorRow ? (
              <div className={editing ? 'grid gap-3 sm:grid-cols-2' : 'space-y-1 text-sm'}>
                {CREATOR_FIELDS.map((f) => renderField(creatorRow, f))}
              </div>
            ) : (
              <p className="text-sm text-raasta-faint">
                This week was submitted before team-video targets were tracked.
              </p>
            )}
          </Section>

          {agentRows.map((row) => {
            const removed = removedIds.includes(row.id);
            return (
              <Section
                key={row.id}
                dimmed={removed}
                title={`${row.agent?.fullName ?? 'Agent'}${
                  row.agent?.position ? ` · ${row.agent.position.name}` : ''
                }`}
                action={
                  editing && (
                    <RowAction
                      onClick={() => onToggleRemoveRow(row.id)}
                      disabled={saving}
                      danger={!removed}
                      icon={removed ? RotateCcw : Trash2}
                      label={removed ? 'Keep' : 'Remove'}
                      aria-label={`${removed ? 'Keep' : 'Remove'} ${
                        row.agent?.fullName ?? 'agent'
                      }`}
                    />
                  )
                }
              >
                {removed ? (
                  <p className="text-xs text-warn-500">
                    Dropped from this week when you save — the numbers the creator committed to
                    for this agent go with it.
                  </p>
                ) : (
                  <div className={editing ? 'grid gap-3 sm:grid-cols-2' : 'space-y-1 text-sm'}>
                    {AGENT_FIELDS.map((f) => renderField(row, f))}
                  </div>
                )}
              </Section>
            );
          })}

          {/* Agents the admin is adding to a week already submitted without them. */}
          {editing &&
            addedAgents.map((agent) => (
              <Section
                key={`new-${agent.id}`}
                title={`${agent.fullName} · ${agent.position.name}`}
                badge={<Badge variant="green">Adding</Badge>}
                action={
                  <RowAction
                    onClick={() => onDiscardNewAgent(agent.id)}
                    disabled={saving}
                    danger
                    icon={Trash2}
                    label="Discard"
                    aria-label={`Discard ${agent.fullName}`}
                  />
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {AGENT_FIELDS.map((f) => (
                    <NumberField
                      key={dk(newRowId(agent.id), f.key)}
                      label={f.label}
                      value={draft[dk(newRowId(agent.id), f.key)] ?? ''}
                      changed
                      disabled={saving}
                      onChange={(v) => onFieldChange(dk(newRowId(agent.id), f.key), v)}
                    />
                  ))}
                </div>
              </Section>
            ))}

          {editing && (
            <Section title="Add an agent to this week">
              {addableAgents.length ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      aria-label="Agent to add"
                      value={addingAgentId}
                      disabled={saving}
                      onChange={(e) => onAddingAgentChange(e.target.value)}
                      placeholder="Select a sales agent"
                      options={addableAgents}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => onAddAgent(addingAgentId)}
                    disabled={!addingAgentId || saving}
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-raasta-faint">
                  Every active sales agent already has a target for this week.
                </p>
              )}
              <CardHint>
                An agent who is not on the creator&apos;s team joins it as well, so the next week
                they file already includes them.
              </CardHint>
            </Section>
          )}
        </>
      )}

      {editing && (
        <div className="pt-4 mt-4 border-t border-raasta-line space-y-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="target-edit-reason"
              className="text-xs font-medium text-raasta-muted"
            >
              Reason for the change (optional)
            </label>
            <textarea
              id="target-edit-reason"
              value={reason}
              maxLength={250}
              rows={2}
              disabled={saving}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. revenue target agreed at 60k in the Monday review"
              className="w-full bg-raasta-surface border border-raasta-border rounded-xl px-3.5 py-2.5 text-raasta-ink text-sm placeholder-raasta-faint resize-y focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/25 disabled:opacity-50"
            />
            <CardHint>The member sees this in their notification.</CardHint>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-raasta-muted">{editSummary}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  badge,
  action,
  dimmed,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('pt-4 mt-4 border-t border-raasta-line', dimmed && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold text-raasta-muted flex items-center gap-1.5 min-w-0">
          <span className="truncate">{title}</span>
          {badge}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Remove / keep / discard, sized to sit beside a section title. */
function RowAction({
  onClick,
  disabled,
  danger,
  icon: Icon,
  label,
  'aria-label': ariaLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
        danger
          ? 'text-raasta-faint hover:text-bad-500 hover:bg-bad-50'
          : 'text-raasta-muted hover:text-raasta-ink hover:bg-raasta-subtle',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-raasta-muted">{label}</span>
      <span className="text-raasta-ink font-medium text-right tabular-nums">{value}</span>
    </div>
  );
}

function NumberField({
  label,
  value,
  money,
  changed,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  money?: boolean;
  changed: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  // The "changed" marker rides in the label rather than a hint line, so a field
  // turning dirty does not reflow the grid under the admin's cursor.
  const base = money ? `${label} (AED)` : label;

  return (
    <Input
      label={changed ? `${base} · changed` : base}
      type="number"
      min="0"
      step={money ? '0.01' : '1'}
      inputMode={money ? 'decimal' : 'numeric'}
      placeholder="0"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'tabular-nums',
        changed && 'border-gold-400 ring-2 ring-gold-400/25',
        disabled && 'opacity-60',
      )}
    />
  );
}
