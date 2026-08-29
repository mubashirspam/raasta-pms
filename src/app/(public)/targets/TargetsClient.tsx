'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { submitSalesTarget, submitCreatorTarget } from '@/lib/actions/targets';
import { fmtAED, MONTHS } from '@/lib/domain/helpers';
import type { TeamMember, OperationalWeek, Position, EmployeeCategory } from '@/db/schema';

type MemberWithRelations = TeamMember & {
  category: EmployeeCategory;
  position: Position;
};

interface Props {
  salesMembers: MemberWithRelations[];
  creatorMembers: MemberWithRelations[];
  weeks: OperationalWeek[];
  month: number;
  year: number;
}

type Step = 'category' | 'member' | 'week' | 'form' | 'review' | 'receipt';
type Category = 'sales' | 'creator';

export function TargetsClient({ salesMembers, creatorMembers, weeks, month, year }: Props) {
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberWithRelations | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<OperationalWeek | null>(null);
  const [formData, setFormData] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');

  const members = category === 'sales' ? salesMembers : creatorMembers;

  function field(key: string, defaultVal: number | string = 0) {
    return formData[key] ?? defaultVal;
  }

  function setField(key: string, value: string | number) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // ─── Step: Category ──────────────────────────────────────────────────────
  if (step === 'category') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Submit Weekly Target</h1>
          <p className="text-sm text-gray-500 mt-1">{MONTHS[month]} {year}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'sales', label: 'Sales Agent', icon: '📞' },
            { key: 'creator', label: 'Content Creator', icon: '🎬' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key as Category); setStep('member'); }}
              className="bg-raasta-card border border-raasta-border rounded-xl p-5 text-center hover:border-gold-500/50 hover:bg-gold-500/5 transition-colors"
            >
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-white font-semibold text-sm">{c.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Member ────────────────────────────────────────────────────────
  if (step === 'member') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('category')} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Select Your Name</h1>
        </div>
        <div className="space-y-2">
          {members.length === 0 && (
            <Card><p className="text-gray-500 text-sm">No active {category} members found.</p></Card>
          )}
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => { setSelectedMember(m); setStep('week'); }}
              className="w-full text-left bg-raasta-card border border-raasta-border rounded-xl px-4 py-3 hover:border-gold-500/50 hover:bg-gold-500/5 transition-colors"
            >
              <div className="font-semibold text-white text-sm">{m.fullName}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.memberCode} · {m.position.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Identity confirmation + week ──────────────────────────────────
  if (step === 'week') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('member')} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Select Week</h1>
        </div>

        <Card className="border-gold-500/30 bg-gold-500/5">
          <p className="text-sm text-gray-400">
            You are submitting as:{' '}
            <span className="text-gold-500 font-semibold">{selectedMember?.fullName}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">Not you? Go back and select your name.</p>
        </Card>

        <div className="space-y-2">
          {weeks.map((w) => (
            <button
              key={w.id}
              onClick={() => { setSelectedWeek(w); setStep('form'); }}
              className="w-full text-left bg-raasta-card border border-raasta-border rounded-xl px-4 py-3 hover:border-gold-500/50 hover:bg-gold-500/5 transition-colors"
            >
              <div className="font-semibold text-white text-sm">{w.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{w.startDate} → {w.endDate}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Form ──────────────────────────────────────────────────────────
  if (step === 'form') {
    const isSales = category === 'sales';
    const isLerBdm = isSales && ['LER', 'BDM'].includes(selectedMember?.position.name ?? '');

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('week')} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Weekly Target</h1>
            <p className="text-xs text-gray-500">{selectedWeek?.label}</p>
          </div>
        </div>

        <Card>
          {isSales ? (
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
              <Input label="Developer Visits Target" type="number" min="0"
                value={String(field('developerVisitsTarget'))}
                onChange={(e) => setField('developerVisitsTarget', e.target.value)} />
              {isLerBdm && (
                <Input label="Team Revenue Target (AED) — LER/BDM" type="number" min="0"
                  value={String(field('teamRevenueAmount'))}
                  onChange={(e) => setField('teamRevenueAmount', e.target.value)} />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <CardTitle>Creator Targets</CardTitle>
              <Input label="Reels Target" type="number" min="0"
                value={String(field('reelsTarget'))}
                onChange={(e) => setField('reelsTarget', e.target.value)} />
              <Input label="Viral Videos Target" type="number" min="0"
                value={String(field('viralVideosTarget'))}
                onChange={(e) => setField('viralVideosTarget', e.target.value)} />
              <Input label="Leads Target" type="number" min="0"
                value={String(field('leadsTarget'))}
                onChange={(e) => setField('leadsTarget', e.target.value)} />
              <Input label="Instagram Videos Target" type="number" min="0"
                value={String(field('instagramVideosTarget'))}
                onChange={(e) => setField('instagramVideosTarget', e.target.value)} />
            </div>
          )}
        </Card>

        <Button className="w-full" onClick={() => setStep('review')}>
          Review →
        </Button>
      </div>
    );
  }

  // ─── Step: Review ────────────────────────────────────────────────────────
  if (step === 'review') {
    const isSales = category === 'sales';

    const handleSubmit = async () => {
      setSubmitting(true);
      try {
        const payload = {
          memberId: selectedMember!.id,
          weekId: selectedWeek!.id,
          positionId: selectedMember!.positionId,
          ...formData,
        };

        const result = isSales
          ? await submitSalesTarget(payload)
          : await submitCreatorTarget(payload);

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
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('form')} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Review & Submit</h1>
        </div>

        <Card>
          <div className="space-y-2 text-sm">
            <Row label="Member" value={selectedMember?.fullName ?? ''} />
            <Row label="Week" value={selectedWeek?.label ?? ''} />
            <Row label="Category" value={category === 'sales' ? 'Sales Agent' : 'Content Creator'} />
            {isSales ? (
              <>
                <Row label="Connected Calls" value={String(field('connectedCallsTarget'))} />
                <Row label="Video Calls" value={String(field('videoCallsTarget'))} />
                <Row label="Face-to-Face" value={String(field('faceToFaceTarget'))} />
                <Row label="Revenue Target" value={fmtAED(Number(field('revenueTarget')))} />
                <Row label="Developer Visits" value={String(field('developerVisitsTarget'))} />
              </>
            ) : (
              <>
                <Row label="Reels" value={String(field('reelsTarget'))} />
                <Row label="Viral Videos" value={String(field('viralVideosTarget'))} />
                <Row label="Leads" value={String(field('leadsTarget'))} />
                <Row label="IG Videos" value={String(field('instagramVideosTarget'))} />
              </>
            )}
          </div>
        </Card>

        <Button className="w-full" onClick={handleSubmit} loading={submitting}>
          Submit Target
        </Button>
      </div>
    );
  }

  // ─── Step: Receipt ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="text-center">
        <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <CardTitle>Target Submitted!</CardTitle>
        <p className="text-sm text-gray-500 mt-1">{selectedWeek?.label}</p>

        <div className="mt-4 bg-raasta-dark rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Reference Number</p>
          <p className="text-gold-500 font-mono font-bold text-lg">{referenceNumber}</p>
        </div>

        <p className="text-xs text-gray-600 mt-3">
          Keep this reference number for your records.
        </p>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setStep('category');
          setCategory(null);
          setSelectedMember(null);
          setSelectedWeek(null);
          setFormData({});
          setReferenceNumber('');
        }}
      >
        Submit Another Target
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-raasta-border last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
