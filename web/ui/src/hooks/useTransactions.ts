import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api";
import type { TransactionsQuery } from "@/types/api";

export function useTransactions(q: TransactionsQuery | null) {
  return useQuery({
    queryKey: ["transactions", q],
    queryFn: () => listTransactions(q as TransactionsQuery),
    enabled: !!q?.run_id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
