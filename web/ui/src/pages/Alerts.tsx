import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertsTable } from "@/components/tables/AlertsTable";
import { EmptyState } from "@/components/svg/EmptyState";
import {
  PageHeader,
  LoadingPanel,
  ErrorPanel,
} from "./Dashboard";
import { useRunId } from "@/hooks/useRunId";
import { useAlerts } from "@/hooks/useAlerts";
import { formatNumber } from "@/lib/utils";

export function Alerts() {
  const { runId } = useRunId();
  const { data, isLoading, isError, error } = useAlerts(runId, 25);

  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Alerts" />
        <EmptyState
          title="Select a run to view alerts"
          description="FP-Growth generates risk-ratio alerts after each run completes."
          action={
            <Button asChild variant="outline">
              <Link to="/runs">Go to runs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Alerts" />
        <LoadingPanel label="Loading alerts" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Alerts" />
        <ErrorPanel
          message={(error as Error)?.message ?? "Failed to load alerts"}
        />
      </div>
    );
  }

  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        subtitle={`Top ${formatNumber(alerts.length)} risk-ratio alerts — patterns much more common in flagged than general traffic`}
      />
      <Card>
        <CardContent className="p-0">
          {alerts.length > 0 ? (
            <AlertsTable alerts={alerts} />
          ) : (
            <div className="p-8">
              <EmptyState
                title="No alerts yet"
                description="Alerts will appear after FP-Growth finishes processing the flagged set."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
