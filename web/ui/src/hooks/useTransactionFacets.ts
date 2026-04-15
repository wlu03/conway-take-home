import { useQuery } from "@tanstack/react-query";
import { getTransactionFacets } from "@/lib/api";

export function useTransactionFacets(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["transaction-facets", runId],
    queryFn: () => getTransactionFacets(runId as string),
    enabled: !!runId,
    staleTime: 5 * 60_000,
  });
}
