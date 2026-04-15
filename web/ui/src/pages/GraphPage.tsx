import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GraphExplorer } from "@/components/graph/GraphExplorer";
import { EmptyState } from "@/components/svg/EmptyState";
import {
  PageHeader,
  LoadingPanel,
  ErrorPanel,
} from "./Dashboard";
import { useRunId } from "@/hooks/useRunId";
import { useGraph } from "@/hooks/useGraph";
import { formatNumber } from "@/lib/utils";

export function GraphPage() {
  const { runId } = useRunId();
  const [accountInput, setAccountInput] = useState<string>("");
  const [submittedAccount, setSubmittedAccount] = useState<string>("");
  const [depth, setDepth] = useState<number>(1);

  const { data, isLoading, isError, error } = useGraph(
    runId,
    submittedAccount,
    depth
  );

  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Graph explorer" />
        <EmptyState
          title="Select a run to explore the transaction graph"
          action={
            <Button asChild variant="outline">
              <Link to="/runs">Go to runs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <PageHeader
        title="Graph explorer"
        subtitle="Ego-network view centered on a single account"
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmittedAccount(accountInput.trim());
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter an account id"
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                className="pl-9 font-mono"
              />
            </form>
          </div>
          <div className="w-full md:w-32">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Depth
            </label>
            <Input
              type="number"
              min={1}
              max={3}
              step={1}
              value={depth}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) {
                  setDepth(Math.max(1, Math.min(3, Math.round(n))));
                }
              }}
              className="tnum text-center"
            />
          </div>
          <Button
            onClick={() => setSubmittedAccount(accountInput.trim())}
            disabled={!accountInput.trim()}
          >
            Explore
          </Button>
        </CardContent>
      </Card>

      <div className="flex-1 min-h-[500px]">
        {!submittedAccount ? (
          <EmptyState
            className="h-full"
            title="Enter an account to explore"
            description="The graph shows ego-network transactions around the selected account. Red edges indicate flagged activity."
          />
        ) : isLoading ? (
          <LoadingPanel label="Building graph" />
        ) : isError ? (
          <ErrorPanel
            message={(error as Error)?.message ?? "Failed to load graph"}
          />
        ) : data && data.nodes.length > 0 ? (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {formatNumber(data.nodes.length)} nodes ·{" "}
                {formatNumber(data.edges.length)} edges · depth {depth}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <GraphExplorer
                data={data}
                centerAccount={submittedAccount}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            className="h-full"
            title="No graph data for this account"
            description="The account may not exist in this run, or it has no neighbors at the selected depth."
          />
        )}
      </div>
    </div>
  );
}
