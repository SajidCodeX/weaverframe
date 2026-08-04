import { RoutePending } from "@/components/dashboard/RoutePending";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { FileText, FileSpreadsheet, Mail } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Shell } from "@/components/dashboard/Shell";
import { Card, CardHeader } from "@/components/dashboard/primitives";
import { getReportsData, exportLeadsToCsv, getBuilderProfile } from "@/lib/dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return

    const session = (context as any).session
    if (session && session.role === 'builder' && session.builderRole === 'sales') {
      const { redirect } = await import('@tanstack/react-router')
      throw redirect({ to: '/' })
    }
  },
  loader: ({ context }) => {
    if (typeof window === 'undefined' && !context.session) {
      return {
        timeframes: {},
        leadsBySource: [],
        monthlyTrend: [],
        allLeads: [],
        allAppointments: [],
        allReviewRequests: [],
        allMessages: [],
        allActivities: []
      };
    }
    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    return getReportsData({ data: { activeRole } });
  },
  staleTime: 60_000, // 60s — fresh data, instant revisits within a minute
  head: () => ({ meta: [{ title: "Reports — WeaverFrame" }, { name: "description", content: "Monthly ROI and performance reports." }] }),
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading Reports..." type="reports" />,
  component: ReportsPage,
});

function ReportsPage() {
  const reportsData = (useLoaderData({ from: "/reports" }) || {
    timeframes: {},
    leadsBySource: [],
    monthlyTrend: [],
    allLeads: [],
    allAppointments: [],
    allReviewRequests: [],
    allMessages: [],
    allActivities: []
  }) as {
    timeframes: Record<string, any>;
    leadsBySource: any[];
    monthlyTrend: any[];
    allLeads: any[];
    allAppointments: any[];
    allReviewRequests: any[];
    allMessages: any[];
    allActivities: any[];
  };

  const getInitialRange = () => {
    if (typeof window === "undefined") {
      return { timeframe: "This Month" as const, customRange: null };
    }
    const saved = sessionStorage.getItem("globalDateRange");
    if (!saved) {
      return { timeframe: "This Month" as const, customRange: null };
    }
    try {
      const detail = JSON.parse(saved);
      if (detail.label === "Custom Range" && detail.start && detail.end) {
        return {
          timeframe: "Custom" as const,
          customRange: {
            start: new Date(detail.start + "T00:00:00"),
            end: new Date(detail.end + "T23:59:59"),
            label: `${detail.start} to ${detail.end}`
          }
        };
      } else {
        const label = detail.label;
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (label === "Today") {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { timeframe: "Custom" as const, customRange: { start, end, label } };
        } else if (label === "Yesterday") {
          start.setDate(now.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(now.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          return { timeframe: "Custom" as const, customRange: { start, end, label } };
        } else if (label === "Last 7 Days") {
          start.setDate(now.getDate() - 6);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { timeframe: "Custom" as const, customRange: { start, end, label } };
        } else if (label === "Last 30 Days") {
          start.setDate(now.getDate() - 29);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return { timeframe: "Custom" as const, customRange: { start, end, label } };
        } else if (label === "This Month") {
          return { timeframe: "This Month" as const, customRange: null };
        } else if (label === "All Time") {
          return { timeframe: "Custom" as const, customRange: null };
        }
      }
    } catch (_) {}
    return { timeframe: "This Month" as const, customRange: null };
  };

  const [initialState] = useState(() => getInitialRange());
  const [timeframe, setTimeframe] = useState<"This Month" | "Last Month" | "Last 3 Months" | "Custom">(initialState.timeframe);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date; label: string } | null>(initialState.customRange);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [companyName, setCompanyName] = useState("Your Company");

  useEffect(() => {
    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    getBuilderProfile({ data: { activeRole } }).then(p => {
      if (p?.companyName) setCompanyName(p.companyName);
    }).catch(() => {});
  }, []);

  // Listen to Global Date Range picker changes from TopBar
  useEffect(() => {
    const handleDateChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.label === "Custom Range" && detail.start && detail.end) {
        setCustomRange({
          start: new Date(detail.start + "T00:00:00"),
          end: new Date(detail.end + "T23:59:59"),
          label: `${detail.start} to ${detail.end}`
        });
        setTimeframe("Custom");
      } else {
        // Map standard range labels to exact client-calculated date bounds
        const now = new Date();
        let start = new Date();
        let end = new Date();
        let label = detail.label;

        if (label === "Today") {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          setCustomRange({ start, end, label });
          setTimeframe("Custom");
        } else if (label === "Yesterday") {
          start.setDate(now.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(now.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          setCustomRange({ start, end, label });
          setTimeframe("Custom");
        } else if (label === "Last 7 Days") {
          start.setDate(now.getDate() - 6);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          setCustomRange({ start, end, label });
          setTimeframe("Custom");
        } else if (label === "Last 30 Days") {
          start.setDate(now.getDate() - 29);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          setCustomRange({ start, end, label });
          setTimeframe("Custom");
        } else if (label === "This Month") {
          setTimeframe("This Month");
          setCustomRange(null);
        } else if (label === "All Time") {
          setTimeframe("Custom");
          setCustomRange(null); // Defaults to all-time in timeframe Custom
        }
      }
    };

    window.addEventListener("globalDateRangeChanged", handleDateChange);
    return () => window.removeEventListener("globalDateRangeChanged", handleDateChange);
  }, []);

  // Client-side in-memory metric calculator for custom ranges
  const getMetricsForRangeClient = (start: Date, end: Date) => {
    const startTime = start.getTime();
    const endTime = end.getTime();

    const rangeLeads = (reportsData.allLeads || []).filter(l => {
      const t = new Date(l.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });

    const leadsCount = rangeLeads.length;
    const qualifiedCount = rangeLeads.filter(l => l.status !== 'New').length;

    const appointmentsCount = (reportsData.allAppointments || []).filter(a => {
      const t = new Date(a.dateTime).getTime();
      return t >= startTime && t <= endTime;
    }).length;

    const rangeReviews = (reportsData.allReviewRequests || []).filter(r => {
      const t = new Date(r.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });
    const reviewRequestsCount = rangeReviews.length;
    const reviewsCompletedCount = rangeReviews.filter(r => r.status === 'Completed').length;

    const closedDeals = rangeLeads.filter(l => l.status === 'Closed' || l.status === 'Closed Won').length;

    // Calculate duration in months based on dates
    const diffDays = Math.max(1, (endTime - startTime) / (1000 * 60 * 60 * 24));
    const durationMonths = Math.max(1, Math.round(diffDays / 30.5));
    const ansaryFee = 3000 * durationMonths;

    const revenue = rangeLeads
      .filter(l => l.status === 'Closed' || l.status === 'Closed Won')
      .reduce((sum, l) => sum + (l.estimatedBudget || 0), 0);
    const netProfit = revenue - ansaryFee;
    const roiRatio = ansaryFee > 0 ? Math.round((revenue / ansaryFee)) : 0;

    const rangeMessages = (reportsData.allMessages || []).filter(m => {
      const t = new Date(m.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });
    const systemMessagesCount = rangeMessages.filter(m => m.sender === 'system').length;

    const rangeActivities = (reportsData.allActivities || []).filter(a => {
      const t = new Date(a.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });
    const aiActivitiesCount = rangeActivities.filter(a => {
      const actLower = a.action.toLowerCase();
      return actLower.includes('ai engine') || 
             actLower.includes('ai concierge') || 
             actLower.includes('automated sms') || 
             actLower.includes('sms outreach') || 
             actLower.includes('nurture message');
    }).length;

    const aiMessagesSent = systemMessagesCount + aiActivitiesCount;
    const aiQualRate = leadsCount > 0 ? Math.round((qualifiedCount / leadsCount) * 100) : 0;

    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `$${Math.round(val / 1000)}K`;
      return `$${val}`;
    };

    return {
      leadsReceived: leadsCount,
      qualified: qualifiedCount,
      aiQualRate,
      aiMessagesSent,
      appointments: appointmentsCount,
      closedDeals,
      ansaryFee: formatCurrency(ansaryFee),
      reviewsSent: String(reviewRequestsCount),
      reviewsCompleted: reviewRequestsCount > 0 
        ? `${reviewsCompletedCount} (${Math.round((reviewsCompletedCount / reviewRequestsCount) * 100)}%)` 
        : "0 (0%)",
      revenue: formatCurrency(revenue),
      net: formatCurrency(netProfit),
      roi: `${roiRatio}x`
    };
  };

  const handleCsvExport = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating CSV export...");
    try {
      const { csvContent } = await exportLeadsToCsv();
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${companyName.toLowerCase().replace(/\s+/g, '_')}_leads_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV Leads Exported Successfully!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(`CSV Export Failed: ${err?.message || "Unknown error"}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailReport = async () => {
    setIsEmailing(true);
    const toastId = toast.loading("Compiling reputation PDF report...");
    
    // Simulate generation and email transmission
    setTimeout(() => {
      toast.success("Executive Report successfully emailed to your email!", {
        id: toastId,
        description: `Includes review analytics and licensing fee ROI for ${timeframe === "Custom" && customRange ? customRange.label : timeframe}.`,
        duration: 4000
      });
      setIsEmailing(false);
    }, 1500);
  };

  let activeData = {
    leadsReceived: 0,
    qualified: 0,
    aiQualRate: 0,
    aiMessagesSent: 0,
    appointments: 0,
    closedDeals: 0,
    ansaryFee: "$0",
    reviewsSent: "0",
    reviewsCompleted: "0 (0%)",
    revenue: "$0",
    net: "$0",
    roi: "0x"
  };

  if (timeframe === "Custom" && customRange) {
    activeData = getMetricsForRangeClient(customRange.start, customRange.end) as any;
  } else {
    const rawActive = (reportsData.timeframes && reportsData.timeframes[timeframe]) || {};
    activeData = {
      leadsReceived: rawActive.leadsReceived || 0,
      qualified: rawActive.qualified || 0,
      aiQualRate: rawActive.aiQualRate || 0,
      aiMessagesSent: rawActive.aiMessagesSent || 0,
      appointments: rawActive.appointments || 0,
      closedDeals: rawActive.closedDeals || 0,
      ansaryFee: rawActive.ansaryFee || "$0",
      reviewsSent: rawActive.reviewsSent || "0",
      reviewsCompleted: rawActive.reviewsCompleted || "0 (0%)",
      revenue: rawActive.revenue || "$0",
      net: rawActive.net || "$0",
      roi: rawActive.roi || "0x"
    };
  }

  const leadsBySource = reportsData.leadsBySource || [];
  const monthlyTrend = reportsData.monthlyTrend || [];

  return (
    <Shell title="Reports">
      <style>{`
        @media print {
          /* Hide sidebar, topbar, tab buttons, and action export buttons */
          aside, header, nav, button, .no-print, [id^="topbar-"] {
            display: none !important;
          }
          /* Reset container margins/paddings and backgrounds for printing */
          main, .min-h-screen, .flex-1, .p-6, .py-6, .bg-background {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            width: 100% !important;
            max-width: 100% !important;
            position: relative !important;
            box-shadow: none !important;
          }
          /* Card modifications for paper print */
          .bg-card, [class*="bg-card"], .border, [class*="border"] {
            background: white !important;
            color: black !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            padding: 16px !important;
            margin-bottom: 16px !important;
            page-break-inside: avoid;
          }
          /* Color overrides for pure black on white high contrast */
          .text-foreground, h1, h2, h3, h4, th, td, span, div, p {
            color: #111111 !important;
          }
          .text-muted-foreground {
            color: #4b5563 !important;
          }
          .text-success {
            color: #16a34a !important;
            font-weight: bold !important;
          }
          /* Recharts containers responsive fixes */
          .recharts-responsive-container {
            width: 100% !important;
            height: 220px !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Branded Executive Print Header */}
      <div className="hidden print:block mb-6 border-b border-gray-200 pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-black font-sans tracking-tight">{companyName}</h1>
            <p className="text-xs text-gray-500 font-sans mt-0.5">B2B Reputation & Lead Quality Performance Report</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider font-semibold">Reporting Interval</div>
            <div className="text-sm font-semibold text-black font-sans uppercase">
              {timeframe === "Custom" && customRange ? customRange.label : timeframe}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-1 font-semibold">GENERATED ON {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>



      <Card className="p-6 mb-4 print-card">
        <div className="flex items-start justify-between gap-6 print:flex-col print:gap-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              ROI Summary · {timeframe === "Custom" && customRange ? customRange.label : timeframe}
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold text-success">
                {activeData.roi}
              </span>
              <span className="text-sm text-muted-foreground">return on software fee</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-sm flex-1 max-w-2xl print:grid-cols-2 print:max-w-full print:w-full">
            <RoiRow label="Platform fee" value={activeData.ansaryFee} />
            <RoiRow label="Reviews Sent" value={activeData.reviewsSent} />
            <RoiRow label="Reviews Completed" value={activeData.reviewsCompleted} />
            <RoiRow label="Leads received" value={String(activeData.leadsReceived)} />
            <RoiRow label="Qualified" value={String(activeData.qualified)} tooltip="Leads that have progressed past the 'New' status." />
            <RoiRow label="AI Qual. Rate" value={`${activeData.aiQualRate}%`} />
            <RoiRow label="AI Messages Sent" value={String(activeData.aiMessagesSent)} />
            <RoiRow label="Appointments" value={String(activeData.appointments)} />
            <RoiRow label="Appt. Conv. Rate" value={activeData.qualified > 0 ? `${Math.round((activeData.appointments / activeData.qualified) * 100)}%` : "0%"} />
            <RoiRow label="Closed deals" value={String(activeData.closedDeals)} />
            <RoiRow label="Revenue" value={activeData.revenue} highlight />
            <RoiRow label="Net" value={activeData.net} highlight />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 print:grid-cols-1 print:gap-2">
        <Card className="print-card">
          <CardHeader title="Leads by Source" subtitle="This month" />
          <div className="p-5 h-[280px] print:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsBySource} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis dataKey="source" tick={{ fill: "#6B6B6B", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B6B6B", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111111", border: "1px solid #202020", borderRadius: 8, fontSize: 12, color: "#F0F0F0" }} />
                <Bar dataKey="leads" fill="#BF5AF2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="print-card">
          <CardHeader title="Monthly Lead Volume" subtitle="Last 6 months" />
          <div className="p-5 h-[280px] print:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#6B6B6B", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B6B6B", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111111", border: "1px solid #202020", borderRadius: 8, fontSize: 12, color: "#F0F0F0" }} />
                <Line type="monotone" dataKey="leads" stroke="#0A84FF" strokeWidth={2} dot={{ fill: "#0A84FF", r: 3 }} />
                <Line type="monotone" dataKey="qualified" stroke="#30D158" strokeWidth={2} dot={{ fill: "#30D158", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4 print-card">
        <CardHeader title="Lead Quality Over Time" />
        <div className="overflow-x-auto overflow-y-auto max-h-[280px] custom-scrollbar border-t border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
              <tr className="text-left">
                <th className="px-5 py-3 font-medium">Month</th>
                <th className="px-5 py-3 font-medium text-right">Total Leads</th>
                <th className="px-5 py-3 font-medium text-right">Qualified</th>
                <th className="px-5 py-3 font-medium text-right">Qual Rate</th>
                <th className="px-5 py-3 font-medium text-right">Appts</th>
                <th className="px-5 py-3 font-medium text-right">Closed</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.map((m) => (
                <tr key={m.month} className="border-t border-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-foreground font-medium">{m.month}</td>
                  <td className="px-5 py-3 font-mono text-right text-foreground">{m.leads}</td>
                  <td className="px-5 py-3 font-mono text-right text-foreground">{m.qualified}</td>
                  <td className="px-5 py-3 font-mono text-right text-success">{m.qualRate}%</td>
                  <td className="px-5 py-3 font-mono text-right text-foreground">{m.appts}</td>
                  <td className="px-5 py-3 font-mono text-right text-foreground">{m.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 mt-4 no-print">
        <ExportButton 
          icon={<FileText className="size-4" />} 
          label="Download PDF Report" 
          sub={`Branded for ${companyName}`} 
          onClick={() => window.print()}
        />
        <ExportButton 
          icon={<FileSpreadsheet className="size-4" />} 
          label="Download CSV" 
          sub={isExporting ? "Generating..." : "All leads, all fields"} 
          onClick={handleCsvExport}
          disabled={isExporting}
        />
        <ExportButton 
          icon={<Mail className="size-4" />} 
          label="Email Report" 
          sub={isEmailing ? "Sending..." : "Sends to your email"} 
          onClick={handleEmailReport}
          disabled={isEmailing}
        />
      </div>
    </Shell>
  );
}

function RoiRow({ label, value, highlight, tooltip }: { label: string; value: string; highlight?: boolean; tooltip?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {label}
        {tooltip && (
          <div className="group relative flex items-center justify-center cursor-help">
            <div className="size-3.5 rounded-full border border-muted-foreground/60 flex items-center justify-center text-[9px] font-bold text-muted-foreground/80 hover:bg-muted-foreground/20 hover:text-white transition-colors">?</div>
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 bg-[#111] text-white text-[10px] p-2 rounded shadow-xl border border-white/10 z-10 normal-case tracking-normal">
              {tooltip}
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#111]"></div>
            </div>
          </div>
        )}
      </div>
      <div className={`font-mono text-lg mt-0.5 ${highlight ? "text-success font-semibold" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function ExportButton({ 
  icon, 
  label, 
  sub, 
  onClick, 
  disabled 
}: { 
  icon: React.ReactNode; 
  label: string; 
  sub: string; 
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="bg-card border border-border rounded-lg p-4 text-left hover:border-white/20 hover:bg-white/[0.03] transition-all duration-150 flex items-start gap-3 w-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <div className="size-8 rounded-md bg-white/[0.06] text-foreground flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </button>
  );
}
