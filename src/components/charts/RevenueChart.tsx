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
    <div className="bg-raasta-card border border-raasta-border rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-gold-500 font-semibold text-sm">{fmtAED(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

export function RevenueChart({ data, targetTotal }: RevenueChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
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
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />

          <XAxis
            dataKey="date"
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#2A2A2A' }}
            tickFormatter={(v) => v.slice(5)} // show MM-DD
          />

          <YAxis
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} />

          {targetTotal > 0 && (
            <ReferenceLine
              y={targetTotal}
              stroke="#D4AF37"
              strokeDasharray="6 3"
              strokeOpacity={0.5}
              label={{ value: 'Target', fill: '#D4AF37', fontSize: 10, position: 'right' }}
            />
          )}

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#D4AF37"
            strokeWidth={2}
            fill="url(#revenueGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#D4AF37', stroke: '#0A0A0A', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
