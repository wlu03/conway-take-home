import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  /** Render only the illustration, no text. */
  illustrationOnly?: boolean;
}

/**
 * Empty-state illustration: a faint node network where one central node
 * pulses and the surrounding edges draw themselves on mount.
 */
export function EmptyState({
  className,
  title = "No data yet",
  description,
  action,
  illustrationOnly = false,
}: EmptyStateProps) {
  const illustration = (
    <svg
      viewBox="0 0 220 140"
      width="220"
      height="140"
      role="img"
      aria-hidden={illustrationOnly}
      aria-label={!illustrationOnly ? title : undefined}
      className="text-muted-foreground"
    >
      <title>{title}</title>
      <defs>
        <radialGradient id="empty-pulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(0 72% 62%)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Edges */}
      <g
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M 110 70 L 40 30" className="empty-edge empty-e1" />
        <path d="M 110 70 L 180 30" className="empty-edge empty-e2" />
        <path d="M 110 70 L 40 110" className="empty-edge empty-e3" />
        <path d="M 110 70 L 180 110" className="empty-edge empty-e4" />
        <path d="M 40 30 L 180 30" className="empty-edge empty-e5" />
        <path d="M 40 110 L 180 110" className="empty-edge empty-e6" />
      </g>

      {/* Outer nodes */}
      <g fill="currentColor" fillOpacity="0.7">
        <circle cx="40" cy="30" r="4" />
        <circle cx="180" cy="30" r="4" />
        <circle cx="40" cy="110" r="4" />
        <circle cx="180" cy="110" r="4" />
      </g>

      {/* Pulsing halo + center node */}
      <circle cx="110" cy="70" r="22" fill="url(#empty-pulse)">
        <animate
          attributeName="r"
          values="18;26;18"
          dur="3s"
          calcMode="spline"
          keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.9;0.3;0.9"
          dur="3s"
          calcMode="spline"
          keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="110" cy="70" r="6" fill="hsl(0 72% 55%)">
        <animate
          attributeName="r"
          values="6;7.5;6"
          dur="3s"
          calcMode="spline"
          keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
          repeatCount="indefinite"
        />
      </circle>

      <style>{`
        .empty-edge {
          stroke-dasharray: 180;
          stroke-dashoffset: 180;
          animation: empty-draw 1.1s ease-out forwards;
        }
        .empty-e1 { animation-delay: 0.00s; }
        .empty-e2 { animation-delay: 0.08s; }
        .empty-e3 { animation-delay: 0.16s; }
        .empty-e4 { animation-delay: 0.24s; }
        .empty-e5 { animation-delay: 0.32s; }
        .empty-e6 { animation-delay: 0.40s; }
        @keyframes empty-draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  );

  if (illustrationOnly) return illustration;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card/40 p-10 text-center",
        className
      )}
    >
      {illustration}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
