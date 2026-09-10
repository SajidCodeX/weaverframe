import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  highlight = false,
  lift = false,
}: {
  children: ReactNode;
  className?: string;
  highlight?: boolean;
  lift?: boolean;
}) {
  return (
    <div
      className={`group bg-card border border-border/80 rounded-xl shadow-xs transition-colors ${
        lift ? "card-lift" : ""
      } ${highlight ? "card-highlight" : ""} ${className}`}
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
  const map: Record<string, string> = {
    hot:  "Hot",
    warm: "Warm",
    cold: "Cold",
  };
  return (
    <Badge tone={score}>
      {map[score] || score}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const tone =
    stage === "Closed Won" || stage === "Qualified"
      ? "success"
      : stage === "Closed Lost"
        ? "neutral"
        : stage === "Appointment" || stage === "Site Visit"
          ? "info"
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
