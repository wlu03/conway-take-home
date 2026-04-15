import { useQuery } from "@tanstack/react-query";
import { getGraph } from "@/lib/api";

export function useGraph(
  runId: string | null | undefined,
  account: string,
  depth: number
) {
  return useQuery({
    queryKey: ["graph", runId, account, depth],
    queryFn: () => getGraph(runId as string, account, depth),
    enabled: !!runId && !!account && account.length > 0,
    staleTime: 30_000,
  });
}
