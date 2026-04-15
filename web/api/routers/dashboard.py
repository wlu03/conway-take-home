"""Endpoint returning KPIs and summary charts for a run."""
from __future__ import annotations

import logging
import math

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from web.api import MODELS_DIR, storage
from web.api.schemas import CountryStat, DashboardResponse, HistogramBin

logger = logging.getLogger("web.api.dashboard")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _safe_float(value: object) -> float:
    try:
        f = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(f) or math.isinf(f):
        return 0.0
    return f


def _load_cutoff() -> float:
    """Best-effort load of the trained Isolation Forest cutoff."""
    meta_path = MODELS_DIR / "meta.joblib"
    if not meta_path.exists():
        return 0.0
    try:
        import joblib

        meta = joblib.load(meta_path)
        return _safe_float(meta.get("cutoff", 0.0))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read cutoff from meta.joblib: %s", exc)
        return 0.0


def _top_country_stats(
    df: pd.DataFrame, country_col: str, top_k: int = 10
) -> list[CountryStat]:
    if country_col not in df.columns:
        return []
    grouped = df.groupby(df[country_col].astype(str), dropna=True)
    if "is_anomalous" in df.columns:
        agg = grouped.agg(
            count=(country_col, "size"),
            flagged_count=("is_anomalous", "sum"),
        )
    else:
        agg = grouped.size().to_frame("count")
        agg["flagged_count"] = 0
    agg = agg.sort_values("count", ascending=False).head(top_k)
    return [
        CountryStat(
            country=str(idx),
            count=int(row["count"]),
            flagged_count=int(row["flagged_count"]),
        )
        for idx, row in agg.iterrows()
    ]


@router.get("", response_model=DashboardResponse)
def dashboard(run_id: str = Query(...)) -> DashboardResponse:
    run = storage.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")

    try:
        df = storage.load_scored(run_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"scored data for run {run_id} not found",
        )

    total_tx = int(len(df))
    flagged_count = (
        int(df["is_anomalous"].sum()) if "is_anomalous" in df.columns else 0
    )
    flagged_rate = flagged_count / total_tx if total_tx else 0.0

    # Score histogram: 50 bins over the [0, 1] normalized anomaly score.
    histogram: list[HistogramBin] = []
    if "anomaly_score_normalized" in df.columns and total_tx > 0:
        values = df["anomaly_score_normalized"].astype(float).to_numpy()
        values = values[np.isfinite(values)]
        counts, edges = np.histogram(values, bins=50, range=(0.0, 1.0))
        for i, count in enumerate(counts):
            histogram.append(
                HistogramBin(
                    bucket_low=float(edges[i]),
                    bucket_high=float(edges[i + 1]),
                    count=int(count),
                )
            )

    currency_rate = (
        float(df["is_currency_conversion"].mean())
        if "is_currency_conversion" in df.columns and total_tx > 0
        else 0.0
    )
    high_risk_rate = (
        float(df["any_high_risk"].mean())
        if "any_high_risk" in df.columns and total_tx > 0
        else 0.0
    )

    return DashboardResponse(
        run_id=run_id,
        total_tx=total_tx,
        flagged_count=flagged_count,
        flagged_rate=float(flagged_rate),
        cutoff=_load_cutoff(),
        score_histogram=histogram,
        top_sender_countries=_top_country_stats(df, "Sender_bank_location"),
        top_receiver_countries=_top_country_stats(df, "Receiver_bank_location"),
        currency_conversion_rate=currency_rate,
        high_risk_rate=high_risk_rate,
    )
