"""SQLite-backed run registry and parquet helpers for scored runs.

All filesystem paths are resolved via ``web.api`` so they are independent of
the process cwd.
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

from web.api import DB_PATH, RUNS_DIR, UPLOADS_DIR, ensure_dirs

# A single lock protects writes; sqlite3 handles concurrent reads fine when we
# open short-lived connections.
_DB_LOCK = threading.Lock()


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    """Yield a sqlite3 connection with row access by column name."""
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if missing. Safe to call on every startup."""
    ensure_dirs()
    with _DB_LOCK, get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                run_id        TEXT PRIMARY KEY,
                status        TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                started_at    TEXT,
                finished_at   TEXT,
                rows_scored   INTEGER,
                outliers      INTEGER,
                progress      REAL NOT NULL DEFAULT 0.0,
                stage         TEXT,
                error         TEXT,
                include_graph INTEGER NOT NULL DEFAULT 1,
                source_file   TEXT
            )
            """
        )
        conn.commit()


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = {k: row[k] for k in row.keys()}
    # Cast the boolean-ish columns to proper types for the API layer.
    if "include_graph" in d and d["include_graph"] is not None:
        d["include_graph"] = bool(d["include_graph"])
    return d


def create_run(run_id: str, include_graph: bool, source_file: str) -> dict[str, Any]:
    """Insert a new queued run record and return it."""
    created_at = _iso_now()
    with _DB_LOCK, get_conn() as conn:
        conn.execute(
            """
            INSERT INTO runs (run_id, status, created_at, progress, stage,
                              include_graph, source_file)
            VALUES (?, 'queued', ?, 0.0, 'queued', ?, ?)
            """,
            (run_id, created_at, 1 if include_graph else 0, source_file),
        )
        conn.commit()
    return get_run(run_id)  # type: ignore[return-value]


def update_run(run_id: str, **fields: Any) -> None:
    """Patch a run record with any subset of allowed columns."""
    if not fields:
        return
    allowed = {
        "status",
        "started_at",
        "finished_at",
        "rows_scored",
        "outliers",
        "progress",
        "stage",
        "error",
    }
    bad = set(fields) - allowed
    if bad:
        raise ValueError(f"Cannot update non-whitelisted columns: {bad}")
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [run_id]
    with _DB_LOCK, get_conn() as conn:
        conn.execute(f"UPDATE runs SET {sets} WHERE run_id = ?", values)
        conn.commit()


def set_stage(run_id: str, stage: str, progress: float) -> None:
    """Convenience helper for background jobs to record checkpoints."""
    update_run(run_id, stage=stage, progress=float(progress))


def mark_started(run_id: str) -> None:
    update_run(
        run_id,
        status="running",
        started_at=_iso_now(),
        progress=0.05,
        stage="starting",
    )


def mark_completed(run_id: str, rows_scored: int, outliers: int) -> None:
    update_run(
        run_id,
        status="completed",
        finished_at=_iso_now(),
        rows_scored=int(rows_scored),
        outliers=int(outliers),
        progress=1.0,
        stage="done",
        error=None,
    )


def mark_failed(run_id: str, error: str) -> None:
    update_run(
        run_id,
        status="failed",
        finished_at=_iso_now(),
        error=error[:2000],
        stage="failed",
    )


def get_run(run_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    return _row_to_dict(row)


def list_runs() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM runs ORDER BY created_at DESC"
        ).fetchall()
    return [d for d in (_row_to_dict(r) for r in rows) if d is not None]


# ---------------------------------------------------------------------------
# Parquet helpers
# ---------------------------------------------------------------------------

def scored_parquet_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}.parquet"


def alerts_parquet_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}_alerts.parquet"


def upload_csv_path(run_id: str) -> Path:
    return UPLOADS_DIR / f"{run_id}.csv"


def save_scored(run_id: str, df: pd.DataFrame) -> Path:
    """Write the scored dataframe to parquet. Drops un-serialisable columns."""
    ensure_dirs()
    out = df.copy()
    # parquet doesn't love timedelta64 columns; coerce Time to seconds if present
    if "Time" in out.columns and pd.api.types.is_timedelta64_dtype(out["Time"]):
        out["Time"] = out["Time"].dt.total_seconds()
    # DateTime is fine as datetime64; Date too.
    path = scored_parquet_path(run_id)
    out.to_parquet(path, index=False, engine="pyarrow")
    return path


def save_alerts(run_id: str, alerts: pd.DataFrame) -> Path | None:
    if alerts is None or alerts.empty:
        return None
    ensure_dirs()
    path = alerts_parquet_path(run_id)
    to_write = alerts.copy()
    # The `rank` is an index name in run.py's format_alerts output — promote it
    # to a real column so downstream readers don't lose it.
    if to_write.index.name == "rank":
        to_write = to_write.reset_index()
    to_write.to_parquet(path, index=False, engine="pyarrow")
    return path


def load_scored(run_id: str) -> pd.DataFrame:
    path = scored_parquet_path(run_id)
    if not path.exists():
        raise FileNotFoundError(f"Scored parquet for run {run_id} not found")
    return pd.read_parquet(path, engine="pyarrow")


def load_alerts(run_id: str) -> pd.DataFrame:
    path = alerts_parquet_path(run_id)
    if not path.exists():
        return pd.DataFrame()
    return pd.read_parquet(path, engine="pyarrow")
