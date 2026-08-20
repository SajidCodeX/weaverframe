import React from "react";
import { m, LazyMotion, domAnimation } from "framer-motion";

interface RoiChartProps {
  chartData: Array<{ month: string; baseline: number; weaverframe: number }>;
}

export default function RoiProjectionChart({ chartData }: RoiChartProps) {
  const maxVal = Math.max(...chartData.map(d => Math.max(d.baseline, d.weaverframe)));
  const minVal = 0;

  // SVG Coordinates mapping
  const toX = (index: number, width: number) => (index / (chartData.length - 1)) * width;
  const toY = (val: number, height: number) => height - ((val - minVal) / (maxVal - minVal)) * height;

  const width = 1000;
  const height = 300;

  // Generate path data (smooth curve via bezier could be done, but linear is close enough to monotone for this stylistic chart)
  const createPath = (key: 'baseline' | 'weaverframe') => {
    return chartData.map((d, i) => {
      const x = toX(i, width);
      const y = toY(d[key], height);
      if (i === 0) return `M ${x},${y}`;
      // simple cubic bezier for smoothing (monotone approximation)
      const prevX = toX(i - 1, width);
      const prevY = toY(chartData[i - 1][key], height);
      const cp1x = prevX + (x - prevX) / 2;
      return `C ${cp1x},${prevY} ${cp1x},${y} ${x},${y}`;
    }).join(" ");
  };

  const createArea = (key: 'baseline' | 'weaverframe') => {
    const linePath = createPath(key);
    return `${linePath} L ${width},${height} L 0,${height} Z`;
  };

  return (
    <div className="w-full h-full relative flex flex-col group pt-4">
      <LazyMotion features={domAnimation}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
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

          {/* Baseline Area */}
          <m.path
            d={createArea('baseline')}
            fill="url(#baseGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />
          <m.path
            d={createPath('baseline')}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={2}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          {/* WeaverFrame Area */}
          <m.path
            d={createArea('weaverframe')}
            fill="url(#goldGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          />
          <m.path
            d={createPath('weaverframe')}
            fill="none"
            stroke="#c9a84c"
            strokeWidth={3}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
          />
        </svg>

        {/* X Axis Labels */}
        <div className="absolute bottom-[-24px] left-0 right-0 flex justify-between px-2">
          {chartData.map((d, i) => (
            <div key={i} className="text-[9px] text-white/35 font-mono">
              {d.month}
            </div>
          ))}
        </div>
      </LazyMotion>
    </div>
  );
}
