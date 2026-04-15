import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TransactionDetail as TransactionDetailType } from "@/types/api";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Props {
  detail: TransactionDetailType;
}

interface FieldGroup {
  title: string;
  keys: string[];
}

// Order matters: fields render in the listed order, skipping any that are
// missing or filtered out (features/scores live in their own panels).
const GROUPS: FieldGroup[] = [
  {
    title: "When",
    keys: ["Date", "DateTime", "is_off_hours", "is_weekend"],
  },
  {
    title: "Parties",
    keys: [
      "Sender_account",
      "Sender_bank_location",
      "Receiver_account",
      "Receiver_bank_location",
    ],
  },
  {
    title: "Payment",
    keys: [
      "Amount",
      "Payment_currency",
      "Received_currency",
      "Payment_type",
      "is_currency_conversion",
    ],
  },
  {
    title: "Risk signals",
    keys: [
      "any_high_risk_str",
      "any_high_risk",
      "sender_high_risk",
      "receiver_high_risk",
      "sender_blacklist",
      "sender_greylist",
      "receiver_blacklist",
      "receiver_greylist",
      "just_below_2k",
      "below_2k_margin",
      "just_below_5k",
      "below_5k_margin",
      "just_below_10k",
      "below_10k_margin",
      "just_below_50k",
      "below_50k_margin",
    ],
  },
  {
    title: "Ground truth",
    keys: ["Is_laundering", "Laundering_type"],
  },
];

const LABELS: Record<string, string> = {
  Date: "Date",
  DateTime: "Timestamp",
  Sender_account: "Sender",
  Receiver_account: "Receiver",
  Sender_bank_location: "Sender bank",
  Receiver_bank_location: "Receiver bank",
  Amount: "Amount",
  Payment_currency: "Paid in",
  Received_currency: "Received as",
  Payment_type: "Type",
  is_currency_conversion: "Currency conversion",
  any_high_risk_str: "High-risk entity",
  any_high_risk: "Any high-risk flag",
  sender_high_risk: "Sender high-risk",
  receiver_high_risk: "Receiver high-risk",
  sender_blacklist: "Sender blacklisted",
  sender_greylist: "Sender greylisted",
  receiver_blacklist: "Receiver blacklisted",
  receiver_greylist: "Receiver greylisted",
  just_below_2k: "Just below $2K",
  below_2k_margin: "Margin to $2K",
  just_below_5k: "Just below $5K",
  below_5k_margin: "Margin to $5K",
  just_below_10k: "Just below $10K",
  below_10k_margin: "Margin to $10K",
  just_below_50k: "Just below $50K",
  below_50k_margin: "Margin to $50K",
  is_off_hours: "Off-hours",
  is_weekend: "Weekend",
  Is_laundering: "Labeled laundering",
  Laundering_type: "Laundering type",
};

const BINARY_KEYS = new Set([
  "is_currency_conversion",
  "any_high_risk",
  "sender_high_risk",
  "receiver_high_risk",
  "sender_blacklist",
  "sender_greylist",
  "receiver_blacklist",
  "receiver_greylist",
  "just_below_2k",
  "just_below_5k",
  "just_below_10k",
  "just_below_50k",
  "is_off_hours",
  "is_weekend",
  "Is_laundering",
]);

const RISKY_WHEN_TRUE = new Set([
  "any_high_risk",
  "sender_high_risk",
  "receiver_high_risk",
  "sender_blacklist",
  "sender_greylist",
  "receiver_blacklist",
  "receiver_greylist",
  "just_below_2k",
  "just_below_5k",
  "just_below_10k",
  "just_below_50k",
  "is_off_hours",
  "is_currency_conversion",
  "Is_laundering",
]);

function isTruthyBinary(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return false;
}

function BooleanBadge({
  value,
  risky,
}: {
  value: unknown;
  risky: boolean;
}) {
  const on = isTruthyBinary(value);
  if (!on) {
    return <span className="text-muted-foreground">No</span>;
  }
  return (
    <Badge variant={risky ? "destructive" : "outline"}>Yes</Badge>
  );
}

function formatDateOnly(value: unknown): string {
  if (typeof value !== "string") return "—";
  // Strip time component — Date comes in as midnight ISO
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== "string") return "—";
  return formatDate(value);
}

function renderValue(
  detail: TransactionDetailType,
  key: string,
  value: unknown
): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";

  if (key === "Date") return formatDateOnly(value);
  if (key === "DateTime") return formatTimestamp(value);

  if (key === "Amount" && typeof value === "number") {
    const cur =
      typeof detail.Payment_currency === "string"
        ? detail.Payment_currency
        : "USD";
    return formatCurrency(value, cur);
  }

  if (BINARY_KEYS.has(key)) {
    return <BooleanBadge value={value} risky={RISKY_WHEN_TRUE.has(key)} />;
  }

  // "Margin to $X" fields — 0 means not near the threshold at all
  if (key.startsWith("below_") && key.endsWith("_margin")) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    return n.toFixed(4);
  }

  if (key === "any_high_risk_str") {
    const s = String(value).toLowerCase();
    const on = s === "yes" || s === "true" || s === "1";
    return on ? (
      <Badge variant="destructive">Yes</Badge>
    ) : (
      <span className="text-muted-foreground">No</span>
    );
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }
  return String(value);
}

export function TransactionDetail({ detail }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Transaction</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Raw fields from the pipeline, grouped by topic
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUPS.map((group) => {
          const rows = group.keys
            .filter((k) => k in detail)
            .map((k) => [k, (detail as Record<string, unknown>)[k]] as const);
          if (rows.length === 0) return null;
          return (
            <section key={group.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <dl className="divide-y divide-border/60 text-sm">
                {rows.map(([k, v]) => (
                  <div
                    key={k}
                    className="grid grid-cols-[160px_1fr] gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {LABELS[k] ?? k}
                    </dt>
                    <dd className="break-all text-foreground tnum">
                      {renderValue(detail, k, v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
