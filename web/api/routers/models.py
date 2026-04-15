"""Endpoint exposing metadata about the trained models directory."""
from __future__ import annotations

import logging

from fastapi import APIRouter

from web.api import MODELS_DIR
from web.api.schemas import ModelFile, ModelsResponse

logger = logging.getLogger("web.api.models")

router = APIRouter(prefix="/models", tags=["models"])

# Joblib artifacts expected by :func:`pipeline.score.load_models`.
_EXPECTED_FILES = (
    "isolation_forest.joblib",
    "scaler.joblib",
    "mcd.joblib",
    "mad_params.joblib",
    "meta.joblib",
)


@router.get("", response_model=ModelsResponse)
def get_models() -> ModelsResponse:
    """Return cutoff, feature list, and on-disk file info.

    If ``models/`` is missing or incomplete, ``models_loaded`` is ``False`` and
    defaults are returned instead of raising.
    """
    files_present: list[ModelFile] = []
    all_present = MODELS_DIR.exists()
    for name in _EXPECTED_FILES:
        path = MODELS_DIR / name
        if path.exists():
            files_present.append(
                ModelFile(name=name, size_bytes=int(path.stat().st_size))
            )
        else:
            all_present = False

    cutoff = 0.0
    features: list[str] = []
    if all_present:
        try:
            # Lazy import — joblib pulls in sklearn which is heavy.
            import joblib

            meta = joblib.load(MODELS_DIR / "meta.joblib")
            cutoff = float(meta.get("cutoff", 0.0))
            features = list(meta.get("features", []))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to read meta.joblib: %s", exc)
            all_present = False

    return ModelsResponse(
        cutoff=cutoff,
        features=features,
        n_features=len(features),
        models_loaded=bool(all_present and features),
        model_files=files_present,
    )
