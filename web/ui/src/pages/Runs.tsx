import { Card, CardContent } from "@/components/ui/card";
import { UploadDialog } from "@/components/runs/UploadDialog";
import { RunsTable } from "@/components/tables/RunsTable";
import { EmptyState } from "@/components/svg/EmptyState";
import { PageHeader, LoadingPanel, ErrorPanel } from "./Dashboard";
import { useRuns } from "@/hooks/useRuns";
import { formatNumber } from "@/lib/utils";

export function Runs() {
  const { data, isLoading, isError, error } = useRuns({ autoPoll: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runs"
        subtitle={
          data ? `${formatNumber(data.runs.length)} total runs` : undefined
        }
        action={<UploadDialog />}
      />

      {isLoading && !data ? (
        <LoadingPanel label="Loading runs" />
      ) : isError ? (
        <ErrorPanel
          message={(error as Error)?.message ?? "Failed to load runs"}
        />
      ) : data && data.runs.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <RunsTable runs={data.runs} />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No runs yet"
          description="Upload a CSV to score your first batch of transactions."
          action={<UploadDialog />}
        />
      )}
    </div>
  );
}
