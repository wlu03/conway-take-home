"""FastAPI backend wrapping the AML fraud-detection pipeline."""

from pathlib import Path

# Resolve project root two levels up from this file: .../fraud-detection/web/api -> .../fraud-detection
PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"

API_DIR = Path(__file__).resolve().parent
DATA_DIR = API_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
RUNS_DIR = DATA_DIR / "runs"
DB_PATH = DATA_DIR / "jobs.db"


def ensure_dirs() -> None:
    """Create data directories at runtime if missing."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)


__all__ = [
    "PROJECT_ROOT",
    "MODELS_DIR",
    "API_DIR",
    "DATA_DIR",
    "UPLOADS_DIR",
    "RUNS_DIR",
    "DB_PATH",
    "ensure_dirs",
]
