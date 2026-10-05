import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Building2,
  Mail,
  SlidersHorizontal,
  Brain,
  Users,
  X,
  RotateCcw,
} from "lucide-react";

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  href: string;
  actionText: string;
}

export interface ActivationChecklistData {
  steps: ChecklistStep[];
  completedCount: number;
  totalCount: number;
}

const STEP_SHORT_NAMES: Record<string, { label: string; action: string }> = {
  profile: { label: "Brand Profile", action: "Configure" },
  mailbox: { label: "Mailbox", action: "Connect" },
  qualification: { label: "Buyer Rules", action: "Set Rules" },
  brain: { label: "AI Voice", action: "Tune" },
  leads: { label: "First Lead", action: "Add Lead" },
};

const STEP_ICONS: Record<string, React.ElementType> = {
  profile: Building2,
  mailbox: Mail,
  qualification: SlidersHorizontal,
  brain: Brain,
  leads: Users,
};

export function ActivationChecklist({
  data,
}: {
  data?: ActivationChecklistData;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Clear legacy manual overrides so system auto-detection is purely authoritative
      localStorage.removeItem("wf_activation_overrides");

      const savedDismissed = localStorage.getItem("wf_activation_dismissed");
      if (savedDismissed === "true") setIsDismissed(true);
    } catch {}
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem("wf_activation_dismissed", "true");
    } catch {}
  };

  const handleRestore = () => {
    setIsDismissed(false);
    try {
      localStorage.removeItem("wf_activation_dismissed");
    } catch {}
  };

  if (!data || !data.steps || data.steps.length === 0) return null;

  const steps = data.steps;
  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalCount = steps.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount;

  // Restore button when dismissed
  if (isDismissed) {
    return (
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={handleRestore}
          className="text-[11px] font-mono text-muted-foreground/50 hover:text-[#e5d9c5] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="size-3" />
          <span>Show Setup Stepper ({completedCount}/{totalCount})</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-white/[0.08] bg-[#0c0d12]/95 backdrop-blur-xl shadow-lg transition-all duration-200 overflow-hidden">
      {/* ── ULTRA-COMPACT SINGLE-ROW BAR (~50px height) ── */}
      <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Left: Indicator Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="size-7 rounded-lg bg-[#e5d9c5]/10 border border-[#e5d9c5]/25 flex items-center justify-center text-[#e5d9c5]">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-tight">
                Concierge Activation
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border transition-colors ${
                isAllComplete
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-[#e5d9c5]/10 border-[#e5d9c5]/20 text-[#e5d9c5]"
              }`}>
                {completedCount}/{totalCount} · {progressPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Middle: 5 Segmented Stepper Badges (System-driven auto detection) */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 lg:pb-0 flex-1 lg:justify-center">
          {steps.map((step, idx) => {
            const shortInfo = STEP_SHORT_NAMES[step.id] || { label: step.title, action: "Go" };

            return step.isCompleted ? (
              // System Verified Complete
              <Link
                key={step.id}
                to={step.href as any}
                title={`${step.title} — Verified & Active in System (Click to inspect/edit)`}
                className="group shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.08] hover:bg-emerald-500/15 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-400 text-[11px] font-mono transition-all cursor-pointer"
              >
                <div className="size-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="size-2.5 text-emerald-400 stroke-[3]" />
                </div>
                <span className="text-white/90 group-hover:text-white transition-colors">
                  {shortInfo.label}
                </span>
                <span className="text-[9px] text-emerald-400/80 font-sans tracking-wide font-bold">
                  ✓
                </span>
              </Link>
            ) : (
              // Pending Setup (Actionable deep-link with pulsing beacon)
              <Link
                key={step.id}
                to={step.href as any}
                className="group shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#e5d9c5]/[0.08] hover:bg-[#e5d9c5]/15 border border-[#e5d9c5]/30 text-white text-[11px] font-mono transition-all shadow-xs hover:border-[#e5d9c5] cursor-pointer"
                title={step.description}
              >
                <div className="size-2 rounded-full bg-[#e5d9c5] animate-pulse" />
                <span className="font-semibold text-[#e5d9c5] group-hover:text-white transition-colors">
                  0{idx + 1}. {shortInfo.label}
                </span>
                <span className="text-[10px] text-white/50 group-hover:text-[#e5d9c5] transition-colors ml-0.5">
                  →
                </span>
              </Link>
            );
          })}
        </div>

        {/* Right: Toggle details & Dismiss */}
        <div className="flex items-center gap-1.5 self-end lg:self-center shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2 py-1 rounded-md text-[10px] font-mono text-white/60 hover:text-white border border-white/[0.06] hover:bg-white/[0.04] transition-all inline-flex items-center gap-1 cursor-pointer"
            title={isExpanded ? "Collapse details" : "View step details"}
          >
            <span>{isExpanded ? "Hide" : "Details"}</span>
            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="size-6 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="size-3" />
          </button>
        </div>

      </div>

      {/* Thin Gold / Emerald Progress Bar at bottom of row */}
      <div className="h-0.5 bg-white/[0.04] w-full">
        <div
          className={`h-full transition-all duration-500 ${
            isAllComplete
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : "bg-gradient-to-r from-[#c9a84c] to-[#e5d9c5]"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── EXPANDED DETAILS (Automated System Status) ── */}
      {isExpanded && (
        <div className="p-4 border-t border-white/[0.06] bg-black/40 space-y-2 animate-in fade-in duration-150">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-2">
            Pillars of Autonomous Execution · Live System Status
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {steps.map((step, idx) => {
              const Icon = STEP_ICONS[step.id] || Sparkles;
              return (
                <div
                  key={step.id}
                  className={`p-3 rounded-xl border transition-all ${
                    step.isCompleted
                      ? "bg-white/[0.02] border-emerald-500/20"
                      : "bg-[#e5d9c5]/[0.03] border-[#e5d9c5]/20 hover:border-[#e5d9c5]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {step.isCompleted ? (
                        <div className="size-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="size-4 rounded-full border border-white/20 flex items-center justify-center shrink-0" />
                      )}
                      <span className="font-mono text-xs font-semibold text-white">
                        0{idx + 1}. {step.title}
                      </span>
                    </div>

                    <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                      step.isCompleted
                        ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                        : "bg-[#e5d9c5]/10 border border-[#e5d9c5]/25 text-[#e5d9c5]"
                    }`}>
                      {step.isCompleted ? "Active" : "Required"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground pl-6 leading-relaxed mb-2.5">
                    {step.description}
                  </p>

                  <div className="pl-6">
                    <Link
                      to={step.href as any}
                      className="text-[10px] font-mono font-medium text-[#e5d9c5] hover:underline inline-flex items-center gap-1"
                    >
                      <span>{step.isCompleted ? "Review Settings" : step.actionText}</span>
                      <ArrowRight className="size-2.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
