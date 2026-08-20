import React from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface RoiChartProps {
  chartData: Array<{ month: string; baseline: number; weaverframe: number }>;
}

export default function RoiProjectionChart({ chartData }: RoiChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#c9a84c" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#c9a84c" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08} />
            <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(val: any) => [`$${(Number(val) / 1000000).toFixed(2)}M`, ""]}
          contentStyle={{
            background: "#0c0d12",
            border: "1px solid rgba(229,217,197,0.25)",
            borderRadius: 8,
            fontSize: 11,
            color: "#e5d9c5",
            boxShadow: "0 10px 25px rgba(0,0,0,0.8)"
          }}
          itemStyle={{ color: "#e5d9c5" }}
          cursor={{ stroke: "rgba(229,217,197,0.15)", strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="baseline" name="Baseline" stroke="rgba(255,255,255,0.25)" fill="url(#baseGrad)" strokeWidth={1} isAnimationActive animationDuration={600} />
        <Area type="monotone" dataKey="weaverframe" name="With WeaverFrame" stroke="#c9a84c" fill="url(#goldGrad)" strokeWidth={2} isAnimationActive animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
