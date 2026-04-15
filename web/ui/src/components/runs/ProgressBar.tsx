import { cn, clamp } from "@/lib/utils";

interface Props {
  value: number; // 0..1
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, className, showLabel }: Props) {
  const pct = clamp(value, 0, 1);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-300"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {showLabel && (
        <span className="tnum min-w-[40px] text-right text-[11px] text-muted-foreground">
          {(pct * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}
