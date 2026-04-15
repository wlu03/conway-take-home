import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/api";

export function useDashboard(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard", runId],
    queryFn: () => getDashboard(runId as string),
    enabled: !!runId,
    staleTime: 30_000,
  });
}
