'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle, CardHint } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { submitMonthlyTarget } from '@/lib/actions/monthly-targets';
import { monthlyFieldsFor } from '@/lib/domain/monthly-targets';
import { fmtAED, MONTHS } from '@/lib/domain/helpers';
import type { MonthlyTarget } from '@/db/schema';
import { Lock, CalendarRange } from 'lucide-react';

type Mode = 'view' | 'form' | 'review';

/** An untouched (or cleared) target field counts as zero. */
const n0 = (v: string | undefined) => (v === '' || v == null ? 0 : Number(v));

/**
 * The member's target for the whole month, set once alongside the weekly ones
 * and locked on submit. It is scored against everything logged in the month,
 * so a week that falls short can be made up later.
 */
export function MonthlyTargetCard({
  isCreator,
  month,
  year,
  target,
}: {
  isCreator: boolean;
  month: number;
  year: number;
  target: MonthlyTarget | null;
}) {
  const router = useRouter();
  const fields = monthlyFieldsFor(isCreator ? 'creator' : 'sales');
  const [mode, setMode] = useState<Mode>('view');
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fmt = (format: 'number' | 'currency', v: number) =>
    format === 'currency' ? fmtAED(v) : v.toLocaleString('en-AE');

  async function handleSubmit() {
    setSubmitting(true);
    const payload = Object.fromEntries(fields.map((f) => [f.key, n0(values[f.key])]));
    const result = await submitMonthlyTarget(payload);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? 'Could not submit');
      return;
    }
    toast.success(`Monthly target submitted · ${result.referenceNumber}`);
    setMode('view');
    router.refresh();
  }

  // ─── Submitted: read-only ────────────────────────────────────────────────
  if (target) {
    const row = target as unknown as Record<string, unknown>;
    return (
      <Card>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <CardTitle>Monthly Target</CardTitle>
            <CardHint>{MONTHS[month]} {year}</CardHint>
          </div>
          <Badge variant="green">
            <Lock className="w-3 h-3" aria-hidden="true" />
            Submitted
          </Badge>
        </div>
        <div className="space-y-1 text-sm">
          {fields.map((f) => (
            <div key={f.key} className="flex justify-between gap-4 py-0.5">
              <span className="text-raasta-muted">{f.label}</span>
              <span className="text-raasta-ink font-medium tabular-nums">
                {fmt(f.format, Number(row[f.key] ?? 0))}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-raasta-faint mt-3">
          Track your progress on Home. Ask your admin if this needs correcting.
        </p>
      </Card>
    );
  }

  // ─── Not set yet ─────────────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <Card className="border-gold-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-50 border border-gold-200 flex items-center justify-center shrink-0">
            <CalendarRange className="w-5 h-5 text-gold-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle>Monthly Target</CardTitle>
            <CardHint>
              Not set for {MONTHS[month]} {year}. Counted against everything you log this month.
            </CardHint>
          </div>
        </div>
        <Button className="w-full mt-4" onClick={() => setMode('form')}>
          Set monthly target
        </Button>
      </Card>
    );
  }

  // ─── Form ────────────────────────────────────────────────────────────────
  if (mode === 'form') {
    return (
      <Card>
        <CardTitle>Monthly Target · {MONTHS[month]} {year}</CardTitle>
        <CardHint>
          {isCreator
            ? 'Totals for the whole month, across all your agents.'
            : 'Totals for the whole month.'}
        </CardHint>
        <div className="space-y-4 mt-4">
          {fields.map((f) => (
            <Input
              key={f.key}
              label={`${f.label} Target`}
              type="number"
              min="0"
              placeholder="0"
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={() => setMode('view')}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => setMode('review')}>
            Review
          </Button>
        </div>
      </Card>
    );
  }

  // ─── Review ──────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardTitle>Review monthly target</CardTitle>
      <CardHint>{MONTHS[month]} {year}</CardHint>
      <div className="bg-warn-50 border border-warn-500/25 rounded-xl px-3 py-2 mt-3">
        <p className="text-xs text-warn-500">
          Once submitted, this target is locked and cannot be edited.
        </p>
      </div>
      <div className="space-y-1 text-sm mt-3">
        {fields.map((f) => (
          <div key={f.key} className="flex justify-between gap-4 py-0.5">
            <span className="text-raasta-muted">{f.label}</span>
            <span className="text-raasta-ink font-medium tabular-nums">
              {fmt(f.format, n0(values[f.key]))}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-5">
        <Button variant="outline" className="flex-1" onClick={() => setMode('form')}>
          Back
        </Button>
        <Button className="flex-1" onClick={handleSubmit} loading={submitting}>
          Submit
        </Button>
      </div>
    </Card>
  );
}
