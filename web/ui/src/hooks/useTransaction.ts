import { useQuery } from "@tanstack/react-query";
import { getTransaction } from "@/lib/api";

export function useTransaction(
  runId: string | null | undefined,
  txIndex: string | number | null | undefined
) {
  return useQuery({
    queryKey: ["transaction", runId, txIndex],
    queryFn: () =>
      getTransaction(runId as string, txIndex as string | number),
    enabled: !!runId && txIndex !== null && txIndex !== undefined,
    staleTime: 60_000,
  });
}
