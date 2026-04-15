import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, clamp } from "@/lib/utils";
import type { TransactionDetail } from "@/types/api";

interface Props {
  scores: TransactionDetail["scores"];
  cutoff: number;
}

function formatRaw(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    return value.toLocaleString("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    });
  }
  return value.toFixed(4);
}

interface ScorerRow {
  key: string;
  label: string;
  normalized: number;
  raw: number;
}

export function ScoreContributionBars({ scores, cutoff }: Props) {
  const rows: ScorerRow[] = [
    {
      key: "if",
      label: "Isolation Forest",
      normalized: scores.isolation_forest_normalized,
      raw: scores.isolation_forest,
    },
    {
      key: "mad",
      label: "MAD",
      normalized: scores.mad_normalized,
      raw: scores.mad,
    },
    {
      key: "mcd",
      label: "MCD",
      normalized: scores.mcd_normalized,
      raw: scores.mcd,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Scorer agreement</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Normalized scores vs classification cutoff{" "}
          <span className="font-mono">{cutoff.toFixed(4)}</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {rows.map((r) => {
            const pct = clamp(r.normalized, 0, 1);
            const cutPct = clamp(cutoff, 0, 1);
            const over = pct >= cutPct;
            return (
              <div key={r.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {r.label}
                  </span>
                  <div className="flex items-center gap-3 tnum text-muted-foreground">
                    <span>raw {formatRaw(r.raw)}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        over ? "text-primary" : "text-foreground/70"
                      )}
                    >
                      {(pct * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      over
                        ? "bg-gradient-to-r from-primary/70 to-primary"
                        : "bg-gradient-to-r from-secondary to-foreground/40"
                    )}
                    style={{ width: `${pct * 100}%` }}
                  />
                  {/* Cutoff marker */}
                  <div
                    className="absolute top-0 h-full w-px bg-[hsl(38_92%_60%)]"
                    style={{ left: `${cutPct * 100}%` }}
                    aria-label="cutoff"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
