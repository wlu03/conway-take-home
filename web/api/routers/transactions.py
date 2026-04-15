"""Endpoints for paginated transaction listing and row detail."""
from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from web.api import MODELS_DIR, storage
from web.api.schemas import (
    FeatureContribution,
    TransactionListResponse,
)

logger = logging.getLogger("web.api.transactions")

router = APIRouter(prefix="/transactions", tags=["transactions"])

_ALLOWED_SORTS = {
    "anomaly_score",
    "anomaly_score_normalized",
    "anomaly_score_mad",
    "anomaly_score_mad_normalized",
    "anomaly_score_mcd",
    "anomaly_score_mcd_normalized",
    "Amount",
    "log_amount",
    "is_anomalous",
    "is_flagged",
    "DateTime",
    "Date",
}


def _to_jsonable(value: Any) -> Any:
    """Convert numpy / pandas scalars into JSON-serialisable primitives."""
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, np.datetime64)):
        # Normalise to ISO string
        try:
            return pd.Timestamp(value).isoformat()
        except Exception:
            return str(value)
    if isinstance(value, pd.Timedelta):
        return value.total_seconds()
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8", errors="replace")
        except Exception:
            return str(value)
    return value


def _row_to_dict(row: pd.Series, tx_index: int) -> dict[str, Any]:
    record: dict[str, Any] = {"tx_index": int(tx_index)}
    for col, val in row.items():
        record[str(col)] = _to_jsonable(val)
    return record


def _load_run_df(run_id: str) -> pd.DataFrame:
    try:
        return storage.load_scored(run_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404, detail=f"scored data for run {run_id} not found"
        )


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    run_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort: str = Query("anomaly_score"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    min_score: float | None = Query(None),
    max_score: float | None = Query(None),
    sender_country: str | None = Query(None),
    receiver_country: str | None = Query(None),
    payment_type: str | None = Query(None),
    flagged: bool | None = Query(None),
    min_amount: float | None = Query(None),
    max_amount: float | None = Query(None),
) -> TransactionListResponse:
    if sort not in _ALLOWED_SORTS:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported sort column '{sort}'",
        )

    df = _load_run_df(run_id)

    if sort not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"sort column '{sort}' not available for this run",
        )

    # Preserve the original row index so we can return stable tx_index values.
    working = df
    if "Sender_bank_location" in working.columns and sender_country:
        working = working[working["Sender_bank_location"].astype(str) == sender_country]
    if "Receiver_bank_location" in working.columns and receiver_country:
        working = working[
            working["Receiver_bank_location"].astype(str) == receiver_country
        ]
    if "Payment_type" in working.columns and payment_type:
        working = working[working["Payment_type"].astype(str) == payment_type]
    if flagged is not None and "is_anomalous" in working.columns:
        working = working[working["is_anomalous"].astype(bool) == bool(flagged)]
    if "Amount" in working.columns:
        if min_amount is not None:
            working = working[working["Amount"] >= float(min_amount)]
        if max_amount is not None:
            working = working[working["Amount"] <= float(max_amount)]
    if "anomaly_score_normalized" in working.columns:
        if min_score is not None:
            working = working[working["anomaly_score_normalized"] >= float(min_score)]
        if max_score is not None:
            working = working[working["anomaly_score_normalized"] <= float(max_score)]

    working = working.sort_values(sort, ascending=(order == "asc"), kind="mergesort")

    total = int(len(working))
    start = (page - 1) * page_size
    end = start + page_size
    page_slice = working.iloc[start:end]

    rows: list[dict[str, Any]] = []
    for idx, row in page_slice.iterrows():
        rows.append(_row_to_dict(row, int(idx)))

    return TransactionListResponse(
        total=total, page=page, page_size=page_size, rows=rows
    )


# ---------------------------------------------------------------------------
# Facets endpoint — distinct values for filter dropdowns
# ---------------------------------------------------------------------------


@router.get("/facets")
def transaction_facets(run_id: str = Query(...)) -> dict[str, list[str]]:
    """Return distinct values for the categorical filter dropdowns.

    The dashboard endpoint caps countries at top-10 and payment types were
    previously hardcoded client-side, so filters silently never matched values
    like "Cash Deposit" or "Cross-border" that exist in the real CSV. Returning
    the actual unique values keeps the dropdowns honest.
    """
    df = _load_run_df(run_id)

    def _distinct(col: str) -> list[str]:
        if col not in df.columns:
            return []
        series = df[col].dropna().astype(str)
        return sorted({v for v in series if v and v != "nan"})

    return {
        "payment_types": _distinct("Payment_type"),
        "sender_countries": _distinct("Sender_bank_location"),
        "receiver_countries": _distinct("Receiver_bank_location"),
        "payment_currencies": _distinct("Payment_currency"),
        "received_currencies": _distinct("Received_currency"),
    }


# ---------------------------------------------------------------------------
# Detail endpoint
# ---------------------------------------------------------------------------

def _load_mad_params() -> tuple[list[str], np.ndarray, np.ndarray] | None:
    """Load the trained feature list + medians/MADs for per-row modified_z."""
    meta_path = MODELS_DIR / "meta.joblib"
    mad_path = MODELS_DIR / "mad_params.joblib"
    if not meta_path.exists() or not mad_path.exists():
        return None
    try:
        import joblib

        meta = joblib.load(meta_path)
        mad_params = joblib.load(mad_path)
        features = list(meta.get("features", []))
        medians = np.asarray(mad_params["medians"], dtype=np.float64)
        mads = np.asarray(mad_params["mads"], dtype=np.float64)
        return features, medians, mads
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not load MAD params: %s", exc)
        return None


def _compute_top_features(
    row: pd.Series,
    features: list[str],
    medians: np.ndarray,
    mads: np.ndarray,
    top_k: int = 5,
) -> list[FeatureContribution]:
    values: list[float] = []
    for feat in features:
        raw = row.get(feat, np.nan)
        try:
            values.append(float(raw))
        except (TypeError, ValueError):
            values.append(float("nan"))
    x = np.asarray(values, dtype=np.float64)
    # 0.6745 constant matches pipeline/score.apply_scores
    with np.errstate(divide="ignore", invalid="ignore"):
        z = 0.6745 * np.abs(x - medians) / mads
    # Zero-MAD features contribute nothing meaningful; mask to zero.
    z = np.where(np.isfinite(z), z, 0.0)
    order = np.argsort(-z)
    out: list[FeatureContribution] = []
    for i in order[:top_k]:
        out.append(
            FeatureContribution(
                name=features[int(i)],
                value=_to_jsonable(x[int(i)]),
                modified_z=_to_jsonable(z[int(i)]),
            )
        )
    return out


_SCORE_COLUMNS = {
    "anomaly_score",
    "anomaly_score_normalized",
    "anomaly_score_mad",
    "anomaly_score_mad_normalized",
    "anomaly_score_mcd",
    "anomaly_score_mcd_normalized",
}


def _score_value(row: pd.Series, key: str) -> float:
    val = _to_jsonable(row.get(key))
    if isinstance(val, (int, float)):
        return float(val)
    return 0.0


@router.get("/{run_id}/{tx_index}")
def transaction_detail(run_id: str, tx_index: int) -> dict[str, Any]:
    df = _load_run_df(run_id)
    if tx_index < 0 or tx_index >= len(df):
        raise HTTPException(
            status_code=404,
            detail=f"tx_index {tx_index} out of range for run {run_id}",
        )

    row = df.iloc[tx_index]

    mad = _load_mad_params()
    feature_names: list[str] = []
    top_features: list[FeatureContribution] = []
    if mad is not None:
        feature_names, medians, mads = mad
        top_features = _compute_top_features(row, feature_names, medians, mads)
    feature_set = set(feature_names)

    raw_fields: dict[str, Any] = {}
    features: dict[str, Any] = {}
    for col, val in row.items():
        key = str(col)
        if key in _SCORE_COLUMNS:
            continue
        jval = _to_jsonable(val)
        if key in feature_set:
            features[key] = jval
        else:
            raw_fields[key] = jval

    scores = {
        "isolation_forest": _score_value(row, "anomaly_score"),
        "isolation_forest_normalized": _score_value(row, "anomaly_score_normalized"),
        "mad": _score_value(row, "anomaly_score_mad"),
        "mad_normalized": _score_value(row, "anomaly_score_mad_normalized"),
        "mcd": _score_value(row, "anomaly_score_mcd"),
        "mcd_normalized": _score_value(row, "anomaly_score_mcd_normalized"),
    }

    return {
        **raw_fields,
        "tx_index": int(tx_index),
        "run_id": run_id,
        "flagged": bool(row.get("is_anomalous", 0)),
        "features": features,
        "scores": scores,
        "why_flagged": {
            "top_features": [f.model_dump() for f in top_features]
        },
    }
