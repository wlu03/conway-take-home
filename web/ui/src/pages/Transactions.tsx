import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionsTable } from "@/components/tables/TransactionsTable";
import { EmptyState } from "@/components/svg/EmptyState";
import {
  PageHeader,
  ErrorPanel,
} from "./Dashboard";
import { useRunId } from "@/hooks/useRunId";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransactionFacets } from "@/hooks/useTransactionFacets";
import { PAGE_SIZE } from "@/lib/constants";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { TransactionsQuery } from "@/types/api";

export function Transactions() {
  const { runId } = useRunId();
  const facets = useTransactionFacets(runId);

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string>("anomaly_score_normalized");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 1]);
  const [senderCountry, setSenderCountry] = useState<string>("");
  const [receiverCountry, setReceiverCountry] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("");
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");

  const senderOptions = useMemo(
    () => facets.data?.sender_countries ?? [],
    [facets.data]
  );
  const receiverOptions = useMemo(
    () => facets.data?.receiver_countries ?? [],
    [facets.data]
  );
  const paymentTypeOptions = useMemo(
    () => facets.data?.payment_types ?? [],
    [facets.data]
  );

  const query: TransactionsQuery | null = runId
    ? {
        run_id: runId,
        page,
        page_size: PAGE_SIZE,
        sort,
        order,
        min_score: scoreRange[0] > 0 ? scoreRange[0] : undefined,
        max_score: scoreRange[1] < 1 ? scoreRange[1] : undefined,
        sender_country: senderCountry || undefined,
        receiver_country: receiverCountry || undefined,
        payment_type: paymentType || undefined,
        flagged: flaggedOnly || undefined,
        min_amount: minAmount ? Number(minAmount) : undefined,
        max_amount: maxAmount ? Number(maxAmount) : undefined,
      }
    : null;

  const { data, isLoading, isError, error, isFetching } =
    useTransactions(query);

  const resetFilters = () => {
    setPage(1);
    setScoreRange([0, 1]);
    setSenderCountry("");
    setReceiverCountry("");
    setPaymentType("");
    setFlaggedOnly(false);
    setMinAmount("");
    setMaxAmount("");
  };

  const filterCount =
    (scoreRange[0] > 0 || scoreRange[1] < 1 ? 1 : 0) +
    (senderCountry ? 1 : 0) +
    (receiverCountry ? 1 : 0) +
    (paymentType ? 1 : 0) +
    (flaggedOnly ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0);

  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transactions" />
        <EmptyState
          title="Select a run to browse transactions"
          action={
            <Button asChild variant="outline">
              <Link to="/runs">Go to runs</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle={
          data
            ? `${formatNumber(total)} rows match current filters`
            : "Browse and filter scored transactions"
        }
      />

      {/* Filter toolbar */}
      <Card className="sticky top-0 z-20 bg-card/95 backdrop-blur">
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Score range */}
          <div className="col-span-1 md:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Score range
            </label>
            <Slider
              value={scoreRange}
              onValueChange={(v) => {
                setScoreRange([v[0], v[1]] as [number, number]);
                setPage(1);
              }}
              min={0}
              max={1}
              step={0.01}
              className="mt-2"
            />
            <div className="mt-1.5 flex items-center justify-between tnum text-xs text-muted-foreground">
              <span>{scoreRange[0].toFixed(2)}</span>
              <span>{scoreRange[1].toFixed(2)}</span>
            </div>
          </div>

          {/* Sender country */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sender country
            </label>
            <Select
              value={senderCountry || "__all__"}
              onValueChange={(v) => {
                setSenderCountry(v === "__all__" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {senderOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Receiver country */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Receiver country
            </label>
            <Select
              value={receiverCountry || "__all__"}
              onValueChange={(v) => {
                setReceiverCountry(v === "__all__" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {receiverOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment type */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payment type
            </label>
            <Select
              value={paymentType || "__all__"}
              onValueChange={(v) => {
                setPaymentType(v === "__all__" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {paymentTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min amount */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Min amount
            </label>
            <Input
              type="number"
              placeholder="0"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Max amount */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Max amount
            </label>
            <Input
              type="number"
              placeholder="∞"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Flagged + reset */}
          <div className="flex items-end justify-between gap-2 md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => {
                  setFlaggedOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[hsl(0_72%_51%)]"
              />
              <span className="text-foreground">Flagged only</span>
            </label>
            <div className="flex items-center gap-2">
              {filterCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  {filterCount} active
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6">
              <ErrorPanel
                message={(error as Error)?.message ?? "Failed to load"}
              />
            </div>
          ) : isLoading && !data ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.rows.length > 0 ? (
            <TransactionsTable
              rows={data.rows}
              runId={runId}
              sort={sort}
              order={order}
              onSortChange={(s, o) => {
                setSort(s);
                setOrder(o);
                setPage(1);
              }}
            />
          ) : (
            <div className="p-8">
              <EmptyState
                title="No transactions match these filters"
                description="Try relaxing the score range, removing country filters, or disabling 'flagged only'."
              />
            </div>
          )}
        </CardContent>
        {data && data.rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {formatNumber(total)}
              {isFetching && " · updating…"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="tnum text-xs text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
