import axios from "axios";
import type {
  Run,
  ModelsInfo,
  TransactionsPage,
  TransactionDetail,
  Alert,
  DashboardData,
  GraphData,
  RunCreateResponse,
  TransactionsQuery,
} from "@/types/api";

export const API_BASE = "http://localhost:8000/api";

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Runs ---
export async function listRuns(): Promise<{ runs: Run[] }> {
  const { data } = await http.get<{ runs: Run[] }>("/runs");
  return data;
}

export async function getRun(runId: string): Promise<Run> {
  const { data } = await http.get<Run>(`/runs/${runId}`);
  return data;
}

export async function createRun(
  file: File,
  includeGraph: boolean
): Promise<RunCreateResponse> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("include_graph", includeGraph ? "true" : "false");
  const { data } = await http.post<RunCreateResponse>("/runs", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// --- Models ---
export async function getModels(): Promise<ModelsInfo> {
  const { data } = await http.get<ModelsInfo>("/models");
  return data;
}

// --- Transactions ---
export async function listTransactions(
  q: TransactionsQuery
): Promise<TransactionsPage> {
  const params: Record<string, string | number | boolean> = {};
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      params[k] = v as string | number | boolean;
    }
  });
  const { data } = await http.get<TransactionsPage>("/transactions", {
    params,
  });
  return data;
}

export async function getTransaction(
  runId: string,
  txIndex: string | number
): Promise<TransactionDetail> {
  const { data } = await http.get<TransactionDetail>(
    `/transactions/${runId}/${txIndex}`
  );
  return data;
}

export interface TransactionFacets {
  payment_types: string[];
  sender_countries: string[];
  receiver_countries: string[];
  payment_currencies: string[];
  received_currencies: string[];
}

export async function getTransactionFacets(
  runId: string
): Promise<TransactionFacets> {
  const { data } = await http.get<TransactionFacets>("/transactions/facets", {
    params: { run_id: runId },
  });
  return data;
}

// --- Alerts ---
export async function listAlerts(
  runId: string,
  topN: number = 25
): Promise<{ alerts: Alert[] }> {
  const { data } = await http.get<{ alerts: Alert[] }>("/alerts", {
    params: { run_id: runId, top_n: topN },
  });
  return data;
}

// --- Dashboard ---
export async function getDashboard(runId: string): Promise<DashboardData> {
  const { data } = await http.get<DashboardData>("/dashboard", {
    params: { run_id: runId },
  });
  return data;
}

// --- Graph ---
export async function getGraph(
  runId: string,
  account: string,
  depth: number = 1
): Promise<GraphData> {
  const { data } = await http.get<GraphData>("/graph", {
    params: { run_id: runId, account, depth },
  });
  return data;
}
