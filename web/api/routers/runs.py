"""Endpoints for creating and inspecting pipeline runs."""
from __future__ import annotations

import logging
import shutil
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from web.api import ensure_dirs
from web.api import jobs, storage
from web.api.schemas import (
    RunCreateResponse,
    RunDetail,
    RunListResponse,
    RunSummary,
)

logger = logging.getLogger("web.api.runs")

router = APIRouter(prefix="/runs", tags=["runs"])


def _to_summary(record: dict) -> RunSummary:
    return RunSummary(**record)


def _to_detail(record: dict) -> RunDetail:
    return RunDetail(**record)


@router.post("", response_model=RunCreateResponse, status_code=201)
async def create_run(
    file: UploadFile = File(...),
    include_graph: bool = Form(True),
) -> RunCreateResponse:
    """Accept a CSV upload, persist it, and queue a scoring run."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="file is required")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="file must be a .csv")

    ensure_dirs()
    run_id = uuid.uuid4().hex[:16]
    upload_path = storage.upload_csv_path(run_id)

    # Stream the upload to disk so we never hold the whole CSV in RAM.
    try:
        with upload_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    finally:
        await file.close()

    record = storage.create_run(
        run_id=run_id,
        include_graph=bool(include_graph),
        source_file=file.filename,
    )

    jobs.submit_run(run_id, upload_path, include_graph=bool(include_graph))

    return RunCreateResponse(
        run_id=run_id,
        status=record["status"],
        created_at=record["created_at"],
    )


@router.get("", response_model=RunListResponse)
def list_runs() -> RunListResponse:
    return RunListResponse(runs=[_to_summary(r) for r in storage.list_runs()])


@router.get("/{run_id}", response_model=RunDetail)
def get_run(run_id: str) -> RunDetail:
    record = storage.get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")
    return _to_detail(record)
