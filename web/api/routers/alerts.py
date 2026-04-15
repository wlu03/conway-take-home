"""Endpoint that surfaces ranked FP-Growth alerts for a run."""
from __future__ import annotations

import logging
import math

from fastapi import APIRouter, HTTPException, Query

from web.api import storage
from web.api.schemas import AlertItem, AlertListResponse

logger = logging.getLogger("web.api.alerts")

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _clean_float(value: object) -> float:
    try:
        f = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(f) or math.isinf(f):
        return 0.0
    return f


@router.get("", response_model=AlertListResponse)
def list_alerts(
    run_id: str = Query(...),
    top_n: int = Query(50, ge=1, le=500),
) -> AlertListResponse:
    run = storage.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")

    df = storage.load_alerts(run_id)
    if df is None or df.empty:
        return AlertListResponse(alerts=[])

    # Accept both the parquet-with-column form (rank) and an indexed form.
    if "rank" not in df.columns:
        df = df.reset_index().rename(columns={"index": "rank"})

    df = df.head(top_n)

    alerts: list[AlertItem] = []
    for _, row in df.iterrows():
        outlier_support = _clean_float(row.get("outlier_support"))
        pop_rate = _clean_float(row.get("pop_rate"))
        risk_ratio = _clean_float(row.get("risk_ratio"))
        n_attrs = row.get("n_attributes")
        try:
            size_val = int(n_attrs)
        except (TypeError, ValueError):
            # fall back to counting the conjuncts in the predicate string
            predicate_str = str(row.get("predicates", ""))
            size_val = max(1, predicate_str.count("∧") + 1)
        rank_val = row.get("rank", 0)
        try:
            rank_int = int(rank_val)
        except (TypeError, ValueError):
            rank_int = 0

        alerts.append(
            AlertItem(
                rank=rank_int,
                predicates=str(row.get("predicates", "")),
                outlier_support=outlier_support,
                population_support=pop_rate,
                risk_ratio=risk_ratio,
                size=size_val,
            )
        )

    return AlertListResponse(alerts=alerts)
