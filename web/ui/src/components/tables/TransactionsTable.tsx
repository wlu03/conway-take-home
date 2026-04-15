import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, clamp, formatCurrency, formatDateShort, truncate } from "@/lib/utils";
import type { TransactionRow } from "@/types/api";

interface Props {
  rows: TransactionRow[];
  runId: string;
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (sort: string, order: "asc" | "desc") => void;
}

interface ColDef {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
}

const COLUMNS: ColDef[] = [
  { key: "Date", label: "Date", sortable: true },
  { key: "Sender_account", label: "Sender" },
  { key: "Receiver_account", label: "Receiver" },
  { key: "Amount", label: "Amount", align: "right", sortable: true },
  { key: "Payment_currency", label: "Currency" },
  { key: "Payment_type", label: "Type" },
  { key: "Sender_bank_location", label: "Sender country" },
  { key: "Receiver_bank_location", label: "Receiver country" },
  {
    key: "anomaly_score_normalized",
    label: "Score",
    align: "right",
    sortable: true,
  },
  { key: "is_flagged", label: "Flagged", align: "right" },
];

function getVal(row: TransactionRow, key: string): unknown {
  if (row[key] !== undefined) return row[key];
  // Try common aliases from the pipeline
  const lower = key.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower) return row[k];
  }
  return undefined;
}

function isFlagged(row: TransactionRow): boolean {
  const candidates = ["is_anomalous", "is_flagged", "flagged", "is_outlier", "outlier"];
  for (const k of candidates) {
    const v = getVal(row, k);
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") {
      if (v.toLowerCase() === "true" || v === "1") return true;
    }
  }
  return false;
}

function getScore(row: TransactionRow): number {
  const raw =
    getVal(row, "anomaly_score_normalized") ?? getVal(row, "score") ?? 0;
  if (typeof raw === "number") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function getRowIndex(row: TransactionRow): string | number {
  const v =
    getVal(row, "tx_index") ??
    getVal(row, "index") ??
    getVal(row, "row_index") ??
    getVal(row, "id");
  if (typeof v === "string" || typeof v === "number") return v;
  return "";
}

export function TransactionsTable({
  rows,
  runId,
  sort,
  order,
  onSortChange,
}: Props) {
  const navigate = useNavigate();

  const handleSort = (key: string) => {
    if (!onSortChange) return;
    const nextOrder: "asc" | "desc" =
      sort === key && order === "desc" ? "asc" : "desc";
    onSortChange(key, nextOrder);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((c) => {
            const isSorted = sort === c.key;
            return (
              <TableHead
                key={c.key}
                className={cn(c.align === "right" && "text-right")}
              >
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm transition-colors",
                      isSorted
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c.label}
                    {isSorted ? (
                      order === "desc" ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                ) : (
                  c.label
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => {
          const flagged = isFlagged(row);
          const score = clamp(getScore(row), 0, 1);
          const rowIdx = getRowIndex(row) || String(idx);
          const amount = Number(getVal(row, "Amount")) || 0;
          const currencyRaw = getVal(row, "Payment_currency");
          const currency =
            typeof currencyRaw === "string" ? currencyRaw : "USD";
          return (
            <TableRow
              key={String(rowIdx) + "-" + idx}
              className="cursor-pointer"
              onClick={() =>
                navigate(`/transactions/${rowIdx}?run=${runId}`)
              }
            >
              <TableCell className="text-xs text-muted-foreground">
                {(() => {
                  const d = getVal(row, "Date");
                  return typeof d === "string" ? formatDateShort(d) : "—";
                })()}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {truncate(String(getVal(row, "Sender_account") ?? "—"), 14)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {truncate(
                  String(getVal(row, "Receiver_account") ?? "—"),
                  14
                )}
              </TableCell>
              <TableCell className="text-right font-medium tnum">
                {formatCurrency(amount, currency)}
              </TableCell>
              <TableCell className="text-xs">{currency}</TableCell>
              <TableCell className="text-xs">
                {String(getVal(row, "Payment_type") ?? "—")}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {String(getVal(row, "Sender_bank_location") ?? "—")}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {String(getVal(row, "Receiver_bank_location") ?? "—")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        flagged
                          ? "bg-gradient-to-r from-primary/60 to-primary"
                          : "bg-foreground/40"
                      )}
                      style={{ width: `${score * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tnum text-xs text-muted-foreground">
                    {(score * 100).toFixed(0)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {flagged ? (
                  <Badge variant="destructive">FLAG</Badge>
                ) : (
                  <Badge variant="outline">ok</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
