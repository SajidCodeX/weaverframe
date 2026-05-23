import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`group bg-card border border-border rounded-lg card-lift ${
        highlight ? "card-highlight" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-border">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ── Vivid colored badges ─────────────────────────────── */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "hot" | "warm" | "cold" | "success" | "info" | "neutral";
  children: ReactNode;
}) {
  const cls: Record<string, string> = {
    hot:     "badge-hot",
    warm:    "badge-warm",
    cold:    "badge-cold",
    success: "badge-success",
    info:    "badge-info",
    neutral: "badge-neutral",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${cls[tone]}`}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: "hot" | "warm" | "cold" }) {
  const map = {
    hot:  { label: "Hot",  emoji: "🔥" },
    warm: { label: "Warm", emoji: "🌤" },
    cold: { label: "Cold", emoji: "🧊" },
  };
  return (
    <Badge tone={score}>
      <span>{map[score].emoji}</span>
      {map[score].label}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const tone =
    stage === "Closed Won"
      ? "success"
      : stage === "Closed Lost"
        ? "neutral"
        : stage === "Appointment" || stage === "Site Visit"
          ? "info"
          : stage === "Qualified"
            ? "warm"
            : "neutral";
  return <Badge tone={tone as never}>{stage}</Badge>;
}

/* ── Priority dot indicator ───────────────────────────── */
export function PriorityDot({ level }: { level: "high" | "medium" | "low" }) {
  const cls = {
    high:   "bg-danger",
    medium: "bg-warning",
    low:    "bg-cold",
  }[level];
  return (
    <span
      className={`inline-block size-2 rounded-full shrink-0 ${cls}`}
      title={`${level} priority`}
    />
  );
}
