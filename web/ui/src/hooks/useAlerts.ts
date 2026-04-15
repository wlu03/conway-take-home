import { useQuery } from "@tanstack/react-query";
import { listAlerts } from "@/lib/api";

export function useAlerts(runId: string | null | undefined, topN: number = 25) {
  return useQuery({
    queryKey: ["alerts", runId, topN],
    queryFn: () => listAlerts(runId as string, topN),
    enabled: !!runId,
    staleTime: 60_000,
  });
}
