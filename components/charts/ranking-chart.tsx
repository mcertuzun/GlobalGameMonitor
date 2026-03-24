"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RankingChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  dataKey: string;
  label: string;
}

export function RankingChart({ data, dataKey, label }: RankingChartProps) {
  // Filter out entries where the value is null and reverse for chronological order
  const filtered = data
    .filter((d) => d[dataKey] !== null && d[dataKey] !== undefined)
    .reverse();

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No data available for {label}.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
