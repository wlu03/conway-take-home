import { cn } from "@/lib/utils";

interface AnimatedUnderlineProps {
  className?: string;
  width?: number;
}

/**
 * A thin horizontal accent line that draws itself via the stroke-draw
 * technique when it mounts. Used under page titles.
 */
export function AnimatedUnderline({
  className,
  width = 80,
}: AnimatedUnderlineProps) {
  return (
    <svg
      viewBox={`0 0 ${width} 4`}
      width={width}
      height="4"
      aria-hidden="true"
      className={cn("block text-primary", className)}
    >
      <defs>
        <linearGradient id="underline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(0 72% 51%)" />
          <stop offset="100%" stopColor="hsl(0 72% 62%)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1="2"
        x2={width}
        y2="2"
        stroke="url(#underline-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          strokeDasharray: width,
          strokeDashoffset: width,
          animation: "underline-draw 0.8s ease-out 0.1s forwards",
        }}
      />
      <style>{`
        @keyframes underline-draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  );
}
