import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunStatusBadge } from "@/components/runs/RunStatusBadge";
import { ProgressBar } from "@/components/runs/ProgressBar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Hash } from "lucide-react";
import { formatDate, formatNumber, truncate } from "@/lib/utils";
import type { Run } from "@/types/api";
import { useRunId } from "@/hooks/useRunId";

interface Props {
  runs: Run[];
}

export function RunsTable({ runs }: Props) {
  const { runId: currentRunId, setRunId } = useRunId();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Finished</TableHead>
          <TableHead className="text-right">Rows scored</TableHead>
          <TableHead className="text-right">Outliers</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead className="w-[120px] text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r) => {
          const isCurrent = r.run_id === currentRunId;
          const canSelect = r.status === "completed";
          return (
            <TableRow key={r.run_id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {truncate(r.run_id, 20)}
                  </span>
                </div>
                {r.error && (
                  <p className="mt-1 text-[11px] text-destructive">
                    {truncate(r.error, 80)}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <RunStatusBadge status={r.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(r.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.finished_at ? formatDate(r.finished_at) : "—"}
              </TableCell>
              <TableCell className="text-right tnum">
                {formatNumber(r.rows_scored ?? null)}
              </TableCell>
              <TableCell className="text-right tnum">
                {formatNumber(r.outliers ?? null)}
              </TableCell>
              <TableCell>
                {r.status === "running" || r.status === "queued" ? (
                  <ProgressBar
                    value={r.progress ?? 0}
                    showLabel
                    className="min-w-[120px]"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {canSelect ? (
                  isCurrent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRunId(r.run_id)}
                    >
                      Select
                    </Button>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
