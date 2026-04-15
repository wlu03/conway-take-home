"""Background job runner that wraps the existing pipeline modules.

Design notes
------------
- Pipeline modules are imported lazily inside :func:`_run_pipeline_job` so the
  FastAPI process can start quickly even on cold imports.
- Jobs run on a single-worker ``ThreadPoolExecutor`` because the pipeline is
  CPU bound (Isolation Forest, pandas feature engineering) and not
  async-friendly. One worker also avoids contention on the models cache.
- Progress is reported at a handful of checkpoints by writing to SQLite.
- Any exception is caught and converted into ``status='failed'`` with a
  human-readable error message. The caller never sees a crash.
"""
from __future__ import annotations

import atexit
import logging
import traceback
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path

from web.api import MODELS_DIR
from web.api import storage

logger = logging.getLogger("web.api.jobs")

# A single background worker is enough; scoring is CPU-bound.
_EXECUTOR: ThreadPoolExecutor = ThreadPoolExecutor(
    max_workers=1, thread_name_prefix="aml-job"
)


def _shutdown() -> None:  # pragma: no cover - process shutdown
    try:
        _EXECUTOR.shutdown(wait=False, cancel_futures=True)
    except Exception:
        pass


atexit.register(_shutdown)


def submit_run(run_id: str, csv_path: Path, include_graph: bool) -> Future:
    """Queue a scoring job for background execution."""
    logger.info("Submitting run %s (include_graph=%s)", run_id, include_graph)
    return _EXECUTOR.submit(_run_pipeline_job, run_id, csv_path, include_graph)


def _run_pipeline_job(run_id: str, csv_path: Path, include_graph: bool) -> None:
    """Run ingestion -> features -> scoring -> explanation for one upload."""
    try:
        storage.mark_started(run_id)

        # Lazy imports keep FastAPI startup fast.
        from pipeline.ingestion import load_data
        from pipeline.features import build_features
        from pipeline.explanation import prepare_attributes, run_explanation
        from pipeline.score import apply_scores, load_models

        storage.set_stage(run_id, "loading_csv", 0.1)
        df = load_data(str(csv_path))
        # Drop any ground-truth columns if the uploader shipped them.
        df = df.drop(columns=["Is_laundering", "Laundering_type"], errors="ignore")

        storage.set_stage(run_id, "building_features", 0.25)
        df = build_features(df, include_graph=include_graph)

        storage.set_stage(run_id, "preparing_attributes", 0.4)
        df = prepare_attributes(df)

        if not MODELS_DIR.exists() or not (MODELS_DIR / "meta.joblib").exists():
            raise FileNotFoundError(
                f"Trained models not found at {MODELS_DIR}. "
                "Run `python run.py data/SAML-D.csv` to train first."
            )

        storage.set_stage(run_id, "loading_models", 0.5)
        models = load_models(str(MODELS_DIR))

        storage.set_stage(run_id, "scoring", 0.6)
        df = apply_scores(
            df,
            clf=models["clf"],
            scaler=models["scaler"],
            mcd=models["mcd"],
            mad_params=models["mad_params"],
            features=models["features"],
            cutoff=models["cutoff"],
        )

        outliers_count = int(df["is_anomalous"].sum()) if "is_anomalous" in df.columns else 0

        # Persist the scored dataframe BEFORE attempting explanation, so a
        # crashing explanation stage still leaves usable results behind.
        storage.set_stage(run_id, "persisting_scores", 0.75)
        storage.save_scored(run_id, df)

        storage.set_stage(run_id, "explanation", 0.85)
        alerts = None
        if outliers_count > 0:
            try:
                alerts = run_explanation(
                    df,
                    min_support=0.001,
                    min_risk_ratio=3.0,
                    max_combination_size=3,
                    top_n=50,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception("Explanation stage failed for run %s", run_id)
                storage.update_run(
                    run_id,
                    error=f"explanation_failed: {exc}",
                )
                alerts = None
        if alerts is not None and not alerts.empty:
            storage.save_alerts(run_id, alerts)

        storage.mark_completed(
            run_id,
            rows_scored=int(len(df)),
            outliers=outliers_count,
        )
        logger.info(
            "Run %s completed: %d rows, %d outliers",
            run_id,
            len(df),
            outliers_count,
        )
    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        logger.error("Run %s failed:\n%s", run_id, tb)
        storage.mark_failed(run_id, f"{type(exc).__name__}: {exc}")
