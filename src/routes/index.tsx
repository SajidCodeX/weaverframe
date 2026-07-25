import { createFileRoute, redirect, Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";

import { ArrowUp, ArrowRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Shell } from "@/components/dashboard/Shell";
import { Card, CardHeader, ScoreBadge } from "@/components/dashboard/primitives";
import { getDashboardData } from "../lib/dashboard";
import { getSessionFn } from "@/lib/auth";
import { obscurePII } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — WeaverFrame" },
      { name: "description", content: "Platform overview." },
    ],
  }),
  // SSR Blocking Loader: Fetches data on the server and blocks HTML streaming until ready.
  // This completely eliminates the need for skeleton loading states.
  loader: async ({ context }) => {
    const session = context.session;
    if (session?.role === 'admin' && !session?.actingAsBuilderId) {
      throw redirect({ to: '/admin' })
    }
    // Pass activeRole so the server function knows which cookie to use
    const activeRole = typeof window !== 'undefined' 
      ? (sessionStorage.getItem('active_role') ?? undefined)
      : undefined;
      
    return await getDashboardData({ data: { activeRole } });
  },
  component: Overview,
});



/* ── Vivid avatar color per initials (deterministic) ─── */
const avatarPalette = ["#FF453A", "#FF9F0A", "#30D158", "#0A84FF", "#BF5AF2", "#FF6B6B", "#34D399"];
function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % avatarPalette.length;
  return avatarPalette[idx];
}

/* ── Tooltip style ──────────────────────────────────── */
const tooltipStyle = {
  background: "#111111",
  border: "1px solid #202020",
  borderRadius: 8,
  fontSize: 12,
  color: "#F0F0F0",
};

/* ── relative time formatting by minutes ── */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return "Just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHr < 24) {
    return `${diffHr}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

/* ── KPI Card ────────────────────────────────────────── */
function Kpi({
  label,
  value,
  sub,
  trend,
  trendValue,
  extra,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "down";
  trendValue?: string;
  extra?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className="p-5" highlight={highlight}>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold text-foreground">
          {value}
        </span>
        {trend === "up" && (
          <span className="flex items-center gap-0.5 text-xs text-success font-medium bg-success/10 px-1.5 py-0.5 rounded border border-success/20">
            <ArrowUp className="size-3" />
            {trendValue || "Up"}
          </span>
        )}
        {trend === "down" && (
          <span className="flex items-center gap-0.5 text-xs text-destructive font-medium bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20">
            <ArrowUp className="size-3 rotate-180" />
            {trendValue || "Down"}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
      {extra && <div className="mt-3">{extra}</div>}
    </Card>
  );
}


/* ── Overview Page ───────────────────────────────────── */
function Overview() {
  const router = useRouter();
  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;

  const data = Route.useLoaderData() as any;



  const {
    totalLeads = 0,
    qualifiedLeads = 0,
    appointmentsSet = 0,
    funnel = [],
    scoreData = [],
    activityFeed = [],
    leadsThisMonth = 0,
    leadsMonthSub = '0 from last month',
    leadsMonthTrend = 'up',
    leadsMonthTrendVal = '+0%',
    pipelineValueStr = '$0',
    pipelineSub = 'Avg $0 · 0 active prospects',
    pipelineTrend = 'up',
    pipelineTrendVal = '+0%',
    avgDaysToBook = 14,
    aiQualRate = 0,
    dailyVolume = [],
    lastSyncAt = null
  } = data;

  const [selectedWeek, setSelectedWeek] = useState(1);
  const chartScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the right-most (latest) data when changing views
  useEffect(() => {
    if (chartScrollRef.current) {
      chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
    }
  }, [dailyVolume]);

  return (
    <Shell title="Overview" lastSyncAt={lastSyncAt}>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <Kpi
          highlight
          label="New Leads (Last 30d)"
          value={leadsThisMonth.toString()}
          sub={leadsMonthSub}
          trend={leadsMonthTrend}
          trendValue={leadsMonthTrendVal}
        />
        <Kpi
          label="Qualified Leads"
          value={qualifiedLeads.toString()}
          sub={`${totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0}% qualification rate`}
          extra={
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bar-animated"
                style={{
                  background: "linear-gradient(90deg, #ffffffff, #0A84FF)",
                  ["--bar-pct" as string]: `${totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0}%`,
                }}
              />
            </div>
          }
        />
        <Kpi
          label="Appointments Booked"
          value={appointmentsSet.toString()}
          sub={`From ${qualifiedLeads} qualified leads`}
          extra={
            <span className="inline-flex text-xs px-2 py-0.5 rounded-md badge-success font-medium">
              {qualifiedLeads > 0 ? Math.round((appointmentsSet / qualifiedLeads) * 100) : 0}% → Appt
            </span>
          }
        />
        <Kpi
          highlight
          label="Est. Pipeline Value"
          value={pipelineValueStr}
          sub={pipelineSub}
          trend={pipelineTrend}
          trendValue={pipelineTrendVal}
        />
      </div>


      {/* Activity + Donut — activity scrolls, score card is h-fit */}
      <div className="grid grid-cols-5 gap-4 mt-4">

        {/* Activity feed — fixed height, matches score card */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader
            title="Lead Activity"
            subtitle="Latest events across your pipeline"
            action={
              <Link className="text-xs text-muted-foreground hover:text-foreground transition-colors" to="/leads">
                View all →
              </Link>
            }
          />
          <div
            className="overflow-y-auto flex-1 custom-scrollbar min-h-0"
            style={{ maxHeight: "392px" }}
          >
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
                No recent lead activity.
              </div>
            ) : (
              <ul className="divide-y divide-border/30 pb-8">
                {activityFeed.slice(0, 20).map((e: any) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-secondary/20 cursor-pointer transition-colors"
                    onClick={() => router.navigate({ to: '/messages' })}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ background: avatarColor(e.name) + "30", color: avatarColor(e.name) }}
                      >
                        {isPrivacyMode 
                          ? "??" 
                          : e.name.split(" ").map((s: string) => s[0]).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">
                          <span className="font-medium">{isPrivacyMode ? obscurePII(e.name, 'name') : e.name}</span>
                          <span className="text-muted-foreground"> · {e.action}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{e.city}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <ScoreBadge score={e.score} />
                      <span className="font-mono text-xs text-muted-foreground w-20 text-right">
                        {formatRelativeTime(e.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Lead score table with sparklines */}
        <Card className="col-span-2 overflow-hidden flex flex-col">
          <CardHeader
            title="Lead Score Distribution"
            subtitle="Pipeline health & momentum"
            action={
              <div className="text-right">
                <div className="text-2xl font-display font-bold text-foreground leading-none mb-0.5">{totalLeads}</div>
                <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Total Leads</div>
              </div>
            }
          />
          <div className="p-5 flex-1 flex flex-col">

            {/* Breakdown Table Header */}
            <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pb-3 border-b border-border">
              <span className="col-span-3">Tier</span>
              <span className="col-span-2 text-right">Leads</span>
              <span className="col-span-3 text-right">Trend (7d)</span>
              <span className="col-span-4 text-right">Share</span>
            </div>

            {/* Table Body */}
            <div className="flex flex-col flex-1 justify-center py-2">
              {scoreData.map((row: any) => {
                // Generate sparkline SVG points
                const max = Math.max(...row.trend);
                const min = Math.min(...row.trend);
                const range = max - min || 1;
                const points = row.trend.map((d: any, i: any) => `${i * (100 / 6)},${20 - ((d - min) / range) * 20}`).join(" ");

                return (
                  <div key={row.label} className="grid grid-cols-12 items-center py-5 border-b border-border/40 last:border-0">
                    {/* Tier */}
                    <div className="col-span-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full" style={{ backgroundColor: row.color, boxShadow: `0 0 10px ${row.color}80` }} />
                        <span className="text-sm font-semibold text-foreground">{row.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium pl-4">{row.budget} avg</span>
                    </div>

                    {/* Leads Count */}
                    <div className="col-span-2 text-right font-display text-xl font-bold text-foreground">
                      {row.count}
                    </div>

                    {/* Sparkline */}
                    <div className="col-span-3 flex justify-end items-center pr-2">
                      <svg viewBox="0 -5 100 30" className="w-14 h-5 overflow-visible">
                        <polyline
                          points={points}
                          fill="none"
                          stroke={row.color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    {/* Share Progress Bar */}
                    <div className="col-span-4 flex items-center justify-end gap-3">
                      <span className="text-xs font-mono font-bold text-right w-8" style={{ color: row.color }}>
                        {row.pct}%
                      </span>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: row.color,
                            width: `${row.pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Stats Footer */}
            <div className="mt-auto pt-5 grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-border/50 bg-secondary/30 flex flex-col justify-between">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Avg Time to Book</div>
                <div className="text-2xl font-display font-semibold text-foreground">{avgDaysToBook} <span className="text-sm text-muted-foreground font-sans font-medium">days</span></div>
              </div>
              <div className="p-4 rounded-xl border border-border/50 bg-secondary/30 flex flex-col justify-between">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">AI Qual. Rate</div>
                <div className="text-2xl font-display font-semibold text-foreground">{aiQualRate}%</div>
              </div>
            </div>

          </div>
        </Card>
      </div>

      {/* Funnel */}
      <Card className="mt-4">
        <CardHeader
          title="Lead Pipeline Funnel"
          subtitle="Conversion drop-off across each stage"
        />
        <div className="px-5 pb-6 pt-2">
          <div className="flex items-stretch gap-0">
            {funnel.map((s: any, i: any) => {
              const colors = [
                { accent: "#BF5AF2", grad: "#BF5AF2, #8B5CF6" },
                { accent: "#0A84FF", grad: "#0A84FF, #38BDF8" },
                { accent: "#30D158", grad: "#30D158, #34D399" },
                { accent: "#FF9F0A", grad: "#FF9F0A, #FCD34D" },
                { accent: "#FF453A", grad: "#FF453A, #F87171" },
              ];
              const c = colors[i];
              const getLinkProps = (label: string) => {
                if (label === 'AI Qualified') return { to: '/leads' as const, search: { stage: 'Qualified' } };
                if (label === 'Builder Notified') return { to: '/leads' as const, search: { stage: 'Builder Notified' } };
                if (label === 'Appointment Set') return { to: '/leads' as const, search: { stage: 'Appointment' } };
                return { to: '/leads' as const };
              };
              const linkProps = getLinkProps(s.label);

              return (
                <div key={s.label} className="flex-1 flex items-stretch">
                  {/* Stage card */}
                  <Link
                    {...linkProps}
                    className="flex-1 rounded-xl border border-border cursor-pointer transition-colors duration-200 hover:border-white/20 block no-underline"
                    style={{ background: "var(--card)" }}
                  >
                    <div className="p-4">
                      {/* Stage number + pct */}
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                          style={{ background: `${c.accent}20`, color: c.accent }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{s.pct}%</span>
                      </div>

                      {/* Big count */}
                      <div className="font-display text-3xl font-bold" style={{ color: c.accent }}>
                        {s.value}
                      </div>

                      {/* Label */}
                      <div className="mt-1.5 text-[11px] font-medium text-muted-foreground leading-tight">
                        {s.label}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bar-animated"
                          style={{
                            background: `linear-gradient(90deg, ${c.grad})`,
                            ["--bar-pct" as string]: `${s.pct}%`,
                          }}
                        />
                      </div>

                      {/* Drop-off (skip first) */}
                      {i > 0 && (
                        <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                          ↓ {100 - s.pct}% dropped
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Arrow connector */}
                  {i < funnel.length - 1 && (
                    <div className="flex items-center px-1 shrink-0">
                      <ArrowRight className="size-3.5" style={{ color: "#5A5A6A" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Lead volume line chart */}
      <Card className="mt-4">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-border/50">
          <div>
            <h3 className="font-display font-medium text-foreground text-sm tracking-tight">Lead Volume</h3>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Current Month Breakdown</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-secondary/50 rounded-md p-0.5 border border-border">
              {Array.from({ length: Math.ceil(dailyVolume.length / 7) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedWeek(i + 1)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-sm transition-colors ${selectedWeek === i + 1 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Wk {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 h-[280px]">
          <div style={{ width: '100%', height: '100%', minWidth: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyVolume.slice((selectedWeek - 1) * 7, selectedWeek * 7)}
                margin={{ top: 5, right: 40, left: -20, bottom: 0 }}
              >
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6B6B6B", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6B6B6B", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total Leads"
                stroke="#0A84FF"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#0A84FF", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="qualified"
                name="Qualified"
                stroke="#30D158"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#30D158", strokeWidth: 0 }}
              />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </Shell>
  );
}
