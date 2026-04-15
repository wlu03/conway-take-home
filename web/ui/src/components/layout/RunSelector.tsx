import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRuns } from "@/hooks/useRuns";
import { useRunId } from "@/hooks/useRunId";
import { formatDate, truncate } from "@/lib/utils";
import { Spinner } from "@/components/svg/Spinner";

export function RunSelector() {
  const { data, isLoading } = useRuns();
  const { runId, setRunId } = useRunId();

  const completed = useMemo(
    () => (data?.runs ?? []).filter((r) => r.status === "completed"),
    [data]
  );

  if (isLoading && !data) {
    return (
      <div className="flex h-10 w-[260px] items-center justify-center rounded-md border border-border bg-background">
        <Spinner size={16} label="Loading runs" />
      </div>
    );
  }

  if (!completed.length) {
    return (
      <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-background px-3 text-xs text-muted-foreground">
        No completed runs — start one on the Runs page
      </div>
    );
  }

  return (
    <Select value={runId ?? undefined} onValueChange={(v) => setRunId(v)}>
      <SelectTrigger className="h-10 w-[260px]">
        <SelectValue placeholder="Select a run" />
      </SelectTrigger>
      <SelectContent>
        {completed.map((r) => (
          <SelectItem key={r.run_id} value={r.run_id}>
            <div className="flex w-full items-center justify-between gap-4">
              <span className="font-mono text-xs">
                {truncate(r.run_id, 14)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(r.created_at)}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
