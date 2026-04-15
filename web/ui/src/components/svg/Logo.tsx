import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** When true (default), shows the wordmark next to the mark. */
  withWordmark?: boolean;
}

/**
 * AML fraud detection logo. A stylized transaction-graph node network:
 * three nodes connected by edges. Nodes pulse (breathing glow recipe)
 * and edges draw themselves on mount (stroke-draw technique).
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 48 48"
        width="36"
        height="36"
        role="img"
        aria-labelledby="logo-title logo-desc"
        className="shrink-0"
      >
        <title id="logo-title">AML Console</title>
        <desc id="logo-desc">
          Animated transaction network graph with pulsing nodes and drawn
          edges.
        </desc>

        <defs>
          <radialGradient id="logo-node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0 72% 62%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="logo-edge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%">
              <animate
                attributeName="stop-color"
                values="hsl(0 72% 51%);hsl(0 72% 62%);hsl(0 72% 51%)"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%">
              <animate
                attributeName="stop-color"
                values="hsl(0 72% 62%);hsl(0 72% 51%);hsl(0 72% 62%)"
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>

        {/* Edges — stroke-draw on mount */}
        <g
          fill="none"
          stroke="url(#logo-edge)"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M 10 14 L 38 14" className="logo-edge logo-edge-1" />
          <path d="M 10 14 L 24 38" className="logo-edge logo-edge-2" />
          <path d="M 38 14 L 24 38" className="logo-edge logo-edge-3" />
        </g>

        {/* Node halos */}
        <circle cx="10" cy="14" r="9" fill="url(#logo-node-glow)" opacity="0.7" />
        <circle cx="38" cy="14" r="9" fill="url(#logo-node-glow)" opacity="0.7" />
        <circle cx="24" cy="38" r="9" fill="url(#logo-node-glow)" opacity="0.7" />

        {/* Nodes — pulsing breathing animation */}
        <circle
          cx="10"
          cy="14"
          r="3.5"
          fill="hsl(0 72% 55%)"
          className="logo-node logo-node-1"
        >
          <animate
            attributeName="r"
            values="3.5;4.4;3.5"
            dur="2.4s"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx="38"
          cy="14"
          r="3.5"
          fill="hsl(0 72% 55%)"
          className="logo-node logo-node-2"
        >
          <animate
            attributeName="r"
            values="3.5;4.4;3.5"
            dur="2.4s"
            begin="0.6s"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            repeatCount="indefinite"
          />
        </circle>
        <circle
          cx="24"
          cy="38"
          r="3.5"
          fill="hsl(0 72% 62%)"
          className="logo-node logo-node-3"
        >
          <animate
            attributeName="r"
            values="3.5;4.6;3.5"
            dur="2.4s"
            begin="1.2s"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            repeatCount="indefinite"
          />
        </circle>

        <style>{`
          .logo-edge {
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: logo-draw 1.1s ease-out forwards;
          }
          .logo-edge-1 { animation-delay: 0.0s; }
          .logo-edge-2 { animation-delay: 0.18s; }
          .logo-edge-3 { animation-delay: 0.36s; }
          .logo-node {
            opacity: 0;
            animation: logo-pop 0.4s ease-out forwards;
            transform-origin: center;
          }
          .logo-node-1 { animation-delay: 0.5s; }
          .logo-node-2 { animation-delay: 0.62s; }
          .logo-node-3 { animation-delay: 0.74s; }
          @keyframes logo-draw { to { stroke-dashoffset: 0; } }
          @keyframes logo-pop {
            from { opacity: 0; transform: scale(0.5); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </svg>

      {withWordmark && (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-foreground">
            MacroBase
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            AML&nbsp;Console
          </span>
        </div>
      )}
    </div>
  );
}
