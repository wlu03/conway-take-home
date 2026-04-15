export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface Run {
  run_id: string;
  status: RunStatus;
  created_at: string;
  finished_at?: string;
  progress?: number;
  rows_scored?: number;
  outliers?: number;
  error?: string;
}

export interface ModelsInfo {
  cutoff: number;
  features: string[];
  n_features: number;
  models_loaded: boolean;
  model_files: { name: string; size_bytes: number }[];
}

// Intentionally flexible — raw transaction row from server
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TransactionRow {
  [key: string]: any;
}

export interface TransactionsPage {
  total: number;
  page: number;
  page_size: number;
  rows: TransactionRow[];
}

export interface WhyFlaggedFeature {
  name: string;
  value: number;
  modified_z: number;
}

export interface TransactionDetail extends TransactionRow {
  features: Record<string, number>;
  scores: {
    isolation_forest: number;
    mad: number;
    mcd: number;
    isolation_forest_normalized: number;
    mad_normalized: number;
    mcd_normalized: number;
  };
  why_flagged: { top_features: WhyFlaggedFeature[] };
}

export interface Alert {
  rank: number;
  predicates: string[] | string;
  outlier_support: number;
  population_support: number;
  risk_ratio: number;
  size: number;
}

export interface DashboardData {
  total_tx: number;
  flagged_count: number;
  flagged_rate: number;
  cutoff: number;
  score_histogram: { bucket_low: number; bucket_high: number; count: number }[];
  top_sender_countries: {
    country: string;
    count: number;
    flagged_count: number;
  }[];
  top_receiver_countries: {
    country: string;
    count: number;
    flagged_count: number;
  }[];
  currency_conversion_rate: number;
  high_risk_rate: number;
}

export interface GraphNode {
  id: string;
  flagged_count: number;
  tx_count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  tx_count: number;
  total_amount: number;
  any_flagged: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RunCreateResponse {
  run_id: string;
  status: RunStatus;
  created_at: string;
}

export interface TransactionsQuery {
  run_id: string;
  page?: number;
  page_size?: number;
  sort?: string;
  order?: "asc" | "desc";
  min_score?: number;
  max_score?: number;
  sender_country?: string;
  receiver_country?: string;
  payment_type?: string;
  flagged?: boolean;
  min_amount?: number;
  max_amount?: number;
}
