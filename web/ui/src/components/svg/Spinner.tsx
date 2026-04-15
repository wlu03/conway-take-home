import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

/**
 * SMIL-driven loading spinner — rotate transform combined with
 * stroke-dashoffset cycling so the arc appears to chase itself.
 */
export function Spinner({ className, size = 28, label = "Loading" }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 50 50"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn("text-primary", className)}
    >
      <title>{label}</title>
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="3"
      />
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="90 150"
        strokeDashoffset="0"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          values="0;-280"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
