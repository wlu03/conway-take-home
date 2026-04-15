import { useQuery } from "@tanstack/react-query";
import { listRuns, getRun } from "@/lib/api";

export function useRuns(opts: { autoPoll?: boolean } = {}) {
  return useQuery({
    queryKey: ["runs"],
    queryFn: listRuns,
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (!opts.autoPoll) return false;
      const data = query.state.data;
      if (!data) return 5_000;
      const hasActive = data.runs.some(
        (r) => r.status === "queued" || r.status === "running"
      );
      return hasActive ? 2_000 : false;
    },
  });
}

export function useRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["run", runId],
    queryFn: () => getRun(runId as string),
    enabled: !!runId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === "queued" || data.status === "running"
        ? 2_000
        : false;
    },
  });
}
