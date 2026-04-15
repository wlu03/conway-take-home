import type { ReactNode } from "react";
import { AlertTriangle, TrendingUp, ShieldCheck, Gauge } from "lucide-react";
import { KPICard } from "@/components/charts/KPICard";
import { ScoreHistogram } from "@/components/charts/ScoreHistogram";
import { CountryBar } from "@/components/charts/CountryBar";
import { EmptyState } from "@/components/svg/EmptyState";
import { Spinner } from "@/components/svg/Spinner";
import { AnimatedUnderline } from "@/components/svg/AnimatedUnderline";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRunId } from "@/hooks/useRunId";
import { useDashboard } from "@/hooks/useDashboard";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Link } from "react-router-dom";

export function Dashboard() {
  const { runId } = useRunId();
  const { data, isLoading, isError, error } = useDashboard(runId);

  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <EmptyState
          title="Select a run to view the dashboard"
          description="Runs contain scored transactions, flagged counts, and feature breakdowns. Upload a CSV to create your first run."
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
        <PageHeader title="Dashboard" />
        <LoadingPanel label="Loading dashboard" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <ErrorPanel message={(error as Error)?.message ?? "Failed to load"} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Run overview — ${formatNumber(data.total_tx)} transactions`}
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total transactions"
          value={formatNumber(data.total_tx)}
          hint="Scored in this run"
          accent="neutral"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KPICard
          label="Flagged"
          value={formatNumber(data.flagged_count)}
          hint="Above cutoff"
          accent="primary"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <KPICard
          label="Flagged rate"
          value={formatPercent(data.flagged_rate)}
          hint="Share of total"
          accent="warning"
          icon={<Gauge className="h-4 w-4" />}
        />
        <KPICard
          label="Cutoff"
          value={data.cutoff.toFixed(4)}
          hint="Classification threshold"
          accent="success"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      {/* Histogram */}
      <ScoreHistogram buckets={data.score_histogram} cutoff={data.cutoff} />

      {/* Country breakdowns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CountryBar
          title="Top sender countries"
          description="Transaction volume by sending jurisdiction"
          data={data.top_sender_countries}
        />
        <CountryBar
          title="Top receiver countries"
          description="Transaction volume by receiving jurisdiction"
          data={data.top_receiver_countries}
        />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Currency conversion rate
            </div>
            <div className="mt-2 text-3xl font-bold tnum">
              {formatPercent(data.currency_conversion_rate)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Transactions where sender and receiver currencies differ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              High-risk jurisdiction rate
            </div>
            <div className="mt-2 text-3xl font-bold tnum">
              {formatPercent(data.high_risk_rate)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              At least one counterparty on the FATF black/grey list
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <AnimatedUnderline width={90} className="mt-1.5" />
        {subtitle && (
          <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/40">
      <Spinner size={32} label={label} />
      <p className="text-xs text-muted-foreground">{label}…</p>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Failed to load
        </h3>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}
