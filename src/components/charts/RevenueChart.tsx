'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fmtAED } from '@/lib/domain/helpers';

interface DataPoint {
  date: string;
  cumulative: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  targetTotal: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-raasta-surface border border-raasta-border rounded-lg shadow-pop px-3 py-2">
      <p className="text-xs text-raasta-muted mb-1">{label}</p>
      {/* Value wears an ink token; the chart title carries the series identity. */}
      <p className="text-raasta-ink font-semibold text-sm tabular-nums">
        {fmtAED(payload[0]?.value ?? 0)}
      </p>
    </div>
  );
}

export function RevenueChart({ data, targetTotal }: RevenueChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-raasta-faint text-sm">
        No data yet for this period
      </div>
    );
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#B8942A" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#B8942A" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEB" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fill: '#6B6B72', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#E3E3DE' }}
            tickFormatter={(v) => v.slice(5)} // show MM-DD
          />

          <YAxis
            tick={{ fill: '#6B6B72', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} />

          {targetTotal > 0 && (
            <ReferenceLine
              y={targetTotal}
              stroke="#6B6B72"
              strokeDasharray="6 3"
              label={{ value: 'Target', fill: '#6B6B72', fontSize: 10, position: 'right' }}
            />
          )}

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#96771F"
            strokeWidth={2}
            fill="url(#revenueGradient)"
            dot={false}
            activeDot={{ r: 5, fill: '#96771F', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
