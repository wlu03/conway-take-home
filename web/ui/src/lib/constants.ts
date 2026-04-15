export const ROUTES = {
  landing: "/",
  dashboard: "/dashboard",
  transactions: "/transactions",
  alerts: "/alerts",
  graph: "/graph",
  runs: "/runs",
} as const;

export const PAGE_SIZE = 50;

export const RUN_STORAGE_KEY = "aml.currentRunId";

export const COLORS = {
  primary: "hsl(0 72% 51%)",
  primarySoft: "hsl(0 72% 51% / 0.25)",
  success: "hsl(142 70% 45%)",
  warning: "hsl(38 92% 50%)",
  muted: "hsl(215 16% 57%)",
  border: "hsl(215 27% 16%)",
  card: "hsl(224 71% 8%)",
  background: "hsl(224 71% 4%)",
} as const;

export const SEVERITY_PALETTE = [
  "#1e3a8a",
  "#1e40af",
  "#4338ca",
  "#6d28d9",
  "#9333ea",
  "#c026d3",
  "#db2777",
  "#e11d48",
  "#dc2626",
  "#b91c1c",
];
