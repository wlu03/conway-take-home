"""Pydantic v2 request/response models for the AML backend API."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", protected_namespaces=())


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------

class RunSummary(_Base):
    run_id: str
    status: str
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    rows_scored: int | None = None
    outliers: int | None = None
    error: str | None = None
    include_graph: bool | None = None
    source_file: str | None = None


class RunDetail(RunSummary):
    progress: float = 0.0
    stage: str | None = None


class RunListResponse(_Base):
    runs: list[RunSummary]


class RunCreateResponse(_Base):
    run_id: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ModelFile(_Base):
    name: str
    size_bytes: int


class ModelsResponse(_Base):
    cutoff: float
    features: list[str]
    n_features: int
    models_loaded: bool
    model_files: list[ModelFile]


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionRow(_Base):
    # Permissive dict with the commonly expected fields promoted as attributes.
    tx_index: int
    data: dict[str, Any]


class TransactionListResponse(_Base):
    total: int
    page: int
    page_size: int
    rows: list[dict[str, Any]]


class FeatureContribution(_Base):
    name: str
    value: float | None
    modified_z: float | None


class WhyFlagged(_Base):
    top_features: list[FeatureContribution]


class TransactionDetailResponse(_Base):
    run_id: str
    tx_index: int
    row: dict[str, Any]
    anomaly_score: float | None
    anomaly_score_normalized: float | None
    anomaly_score_mad: float | None
    anomaly_score_mad_normalized: float | None
    anomaly_score_mcd: float | None
    anomaly_score_mcd_normalized: float | None
    flagged: bool
    why_flagged: WhyFlagged


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertItem(_Base):
    rank: int
    predicates: str
    outlier_support: float
    population_support: float
    risk_ratio: float
    size: int


class AlertListResponse(_Base):
    alerts: list[AlertItem]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class HistogramBin(_Base):
    bucket_low: float
    bucket_high: float
    count: int


class CountryStat(_Base):
    country: str
    count: int
    flagged_count: int


class DashboardResponse(_Base):
    run_id: str
    total_tx: int
    flagged_count: int
    flagged_rate: float
    cutoff: float
    score_histogram: list[HistogramBin]
    top_sender_countries: list[CountryStat]
    top_receiver_countries: list[CountryStat]
    currency_conversion_rate: float
    high_risk_rate: float


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

class GraphNode(_Base):
    id: str
    flagged_count: int
    tx_count: int


class GraphEdge(_Base):
    source: str
    target: str
    tx_count: int
    total_amount: float
    any_flagged: bool


class GraphResponse(_Base):
    run_id: str
    account: str
    depth: int
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    truncated: bool = Field(default=False)
