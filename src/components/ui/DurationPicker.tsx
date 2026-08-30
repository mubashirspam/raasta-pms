'use client';

import { Select } from './Select';
import { fmtDuration } from '@/lib/domain/helpers';

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => ({
  value: h,
  label: `${h} h`,
}));

// Five-minute steps — nobody logs call time to the minute.
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i * 5,
  label: `${i * 5} m`,
}));

interface Props {
  label: string;
  /** Total duration in whole minutes. */
  value: number;
  onChange: (totalMinutes: number) => void;
  hint?: string;
}

/**
 * Hours + minutes pickers over a single minutes value. Storing minutes keeps
 * every consumer (validation, aggregation, display) working in one unit.
 */
export function DurationPicker({ label, value, onChange, hint }: Props) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-raasta-muted">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <Select
          aria-label={`${label} — hours`}
          options={HOUR_OPTIONS}
          value={hours}
          onChange={(e) => onChange(Number(e.target.value) * 60 + minutes)}
        />
        <Select
          aria-label={`${label} — minutes`}
          options={MINUTE_OPTIONS}
          // A stored value off the 5-minute grid (an edited record) still has to
          // show up somewhere, so snap the display down to the nearest step.
          value={minutes - (minutes % 5)}
          onChange={(e) => onChange(hours * 60 + Number(e.target.value))}
        />
      </div>
      {hint && <p className="text-xs text-raasta-faint">{hint}</p>}
      {value > 0 && (
        <p className="text-xs text-raasta-muted">
          Total <span className="text-raasta-ink font-medium">{fmtDuration(value)}</span>
        </p>
      )}
    </div>
  );
}
