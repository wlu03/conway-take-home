import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "neutral";
  icon?: ReactNode;
}

const ACCENTS = {
  primary: {
    a: "hsl(0 72% 51%)",
    b: "hsl(0 72% 35%)",
    ring: "hsl(0 72% 51% / 0.35)",
  },
  success: {
    a: "hsl(142 70% 45%)",
    b: "hsl(142 70% 30%)",
    ring: "hsl(142 70% 45% / 0.35)",
  },
  warning: {
    a: "hsl(38 92% 50%)",
    b: "hsl(38 92% 35%)",
    ring: "hsl(38 92% 50% / 0.35)",
  },
  neutral: {
    a: "hsl(215 27% 30%)",
    b: "hsl(215 27% 16%)",
    ring: "hsl(215 27% 40% / 0.35)",
  },
} as const;

/**
 * KPI card with a subtle animated gradient background — uses the
 * "gradient shift" SMIL recipe, kept slow and low-opacity.
 */
export function KPICard({
  label,
  value,
  hint,
  accent = "neutral",
  icon,
}: KPICardProps) {
  const palette = ACCENTS[accent];
  const gradId = `kpi-grad-${label.replace(/\s+/g, "-")}-${accent}`;

  return (
    <Card className="relative overflow-hidden">
      {/* Animated gradient backdrop */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22]"
        preserveAspectRatio="none"
        viewBox="0 0 200 100"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%">
              <animate
                attributeName="stop-color"
                values={`${palette.a};${palette.b};${palette.a}`}
                dur="8s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%">
              <animate
                attributeName="stop-color"
                values={`${palette.b};${palette.a};${palette.b}`}
                dur="8s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
        <rect width="200" height="100" fill={`url(#${gradId})`} />
      </svg>

      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: palette.ring }}
        aria-hidden
      />

      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="mt-6 flex flex-col gap-1">
          <span
            className={cn(
              "tnum text-3xl font-bold tracking-tight text-foreground"
            )}
          >
            {value}
          </span>
          {hint && (
            <span className="text-xs text-muted-foreground">{hint}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
