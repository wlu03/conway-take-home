import { Fragment, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Alert } from "@/types/api";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

interface Props {
  alerts: Alert[];
}

function normalizePredicates(p: Alert["predicates"]): string[] {
  if (Array.isArray(p)) return p;
  if (typeof p === "string") {
    return p
      .replace(/[{}[\]()]/g, "")
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function AlertsTable({ alerts }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const maxRR = Math.max(1, ...alerts.map((a) => a.risk_ratio));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead className="w-14">Rank</TableHead>
          <TableHead>Predicates</TableHead>
          <TableHead className="text-right">Outlier support</TableHead>
          <TableHead className="text-right">Population support</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead>Risk ratio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((a) => {
          const isOpen = expanded === a.rank;
          const preds = normalizePredicates(a.predicates);
          const rrPct = Math.min(1, a.risk_ratio / maxRR);
          return (
            <Fragment key={a.rank}>
              <TableRow
                className="cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : a.rank)}
              >
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <span className="tnum font-semibold text-foreground">
                    #{a.rank}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {preds.map((p, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="font-mono text-[11px]"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right tnum">
                  {formatPercent(a.outlier_support)}
                </TableCell>
                <TableCell className="text-right tnum text-muted-foreground">
                  {formatPercent(a.population_support)}
                </TableCell>
                <TableCell className="text-right tnum">
                  {formatNumber(a.size)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative h-2 w-32 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                        )}
                        style={{ width: `${rrPct * 100}%` }}
                      />
                    </div>
                    <span className="tnum w-12 text-right text-sm font-semibold text-primary">
                      {a.risk_ratio.toFixed(1)}×
                    </span>
                  </div>
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="bg-card/40">
                  <TableCell />
                  <TableCell colSpan={6} className="py-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-md border border-border bg-background/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Outlier support
                        </div>
                        <div className="mt-1 text-2xl font-bold text-primary tnum">
                          {formatPercent(a.outlier_support)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Share of flagged transactions matching these
                          predicates
                        </div>
                      </div>
                      <div className="rounded-md border border-border bg-background/50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Population support
                        </div>
                        <div className="mt-1 text-2xl font-bold text-foreground tnum">
                          {formatPercent(a.population_support)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Baseline prevalence across the full dataset
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Risk ratio of{" "}
                      <span className="font-semibold text-primary">
                        {a.risk_ratio.toFixed(2)}×
                      </span>{" "}
                      means this pattern is that much more common in flagged
                      transactions than in the full population.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
