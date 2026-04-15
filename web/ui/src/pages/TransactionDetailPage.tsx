import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionDetail } from "@/components/transaction/TransactionDetail";
import { WhyFlagged } from "@/components/transaction/WhyFlagged";
import { FeatureTable } from "@/components/transaction/FeatureTable";
import { ScoreContributionBars } from "@/components/charts/ScoreContributionBars";
import { useRunId } from "@/hooks/useRunId";
import { useTransaction } from "@/hooks/useTransaction";
import { useModels } from "@/hooks/useModels";
import { LoadingPanel, PageHeader, ErrorPanel } from "./Dashboard";
import { EmptyState } from "@/components/svg/EmptyState";

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { runId } = useRunId();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useTransaction(runId, id);
  const { data: models } = useModels();

  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transaction" />
        <EmptyState
          title="No run selected"
          action={
            <Button asChild variant="outline">
              <Link to="/runs">Go to runs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(-1)}
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Transaction
        </h1>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          #{id}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {data && (
          <>
            <Badge variant="outline">
              score {(data.scores.isolation_forest_normalized * 100).toFixed(1)}
              %
            </Badge>
            {data.scores.isolation_forest_normalized >=
            (models?.cutoff ?? 0) ? (
              <Badge variant="destructive">FLAGGED</Badge>
            ) : (
              <Badge variant="success">Below cutoff</Badge>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingPanel label="Loading transaction" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorPanel
          message={(error as Error)?.message ?? "Failed to load transaction"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TransactionDetail detail={data} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <WhyFlagged features={data.why_flagged?.top_features ?? []} />
          <ScoreContributionBars
            scores={data.scores}
            cutoff={models?.cutoff ?? 0}
          />
        </div>
      </div>

      <FeatureTable features={data.features ?? {}} />
    </div>
  );
}
