"""Ego-network builder for a single account from a scored run."""
from __future__ import annotations

import logging

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from web.api import storage
from web.api.schemas import GraphEdge, GraphNode, GraphResponse

logger = logging.getLogger("web.api.graph")

router = APIRouter(prefix="/graph", tags=["graph"])

_MAX_NODES = 100


def _aggregate_edges(df: pd.DataFrame) -> pd.DataFrame:
    """Group transactions into (sender, receiver) edges with aggregates."""
    if df.empty:
        return pd.DataFrame(
            columns=["source", "target", "tx_count", "total_amount", "any_flagged"]
        )
    # Materialise the group keys as plain string columns so naming is stable.
    work = df[["Sender_account", "Receiver_account"]].copy()
    work["source"] = work["Sender_account"].astype(str)
    work["target"] = work["Receiver_account"].astype(str)
    work["__one"] = 1
    if "Amount" in df.columns:
        work["Amount"] = df["Amount"].astype(float)
    if "is_anomalous" in df.columns:
        work["is_anomalous"] = df["is_anomalous"].astype(int)

    agg: dict[str, tuple[str, str]] = {"tx_count": ("__one", "sum")}
    if "Amount" in work.columns:
        agg["total_amount"] = ("Amount", "sum")
    if "is_anomalous" in work.columns:
        agg["any_flagged"] = ("is_anomalous", "max")

    grouped = (
        work.groupby(["source", "target"], sort=False)
        .agg(**agg)
        .reset_index()
    )
    if "total_amount" not in grouped.columns:
        grouped["total_amount"] = 0.0
    if "any_flagged" not in grouped.columns:
        grouped["any_flagged"] = 0
    return grouped


@router.get("", response_model=GraphResponse)
def ego_graph(
    run_id: str = Query(...),
    account: str = Query(...),
    depth: int = Query(1, ge=1, le=3),
) -> GraphResponse:
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

    if "Sender_account" not in df.columns or "Receiver_account" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="scored data is missing Sender_account/Receiver_account columns",
        )

    df = df.copy()
    df["Sender_account"] = df["Sender_account"].astype(str)
    df["Receiver_account"] = df["Receiver_account"].astype(str)
    account = str(account)

    # Confirm the account exists anywhere in the edge table.
    exists = bool(
        ((df["Sender_account"] == account) | (df["Receiver_account"] == account)).any()
    )
    if not exists:
        raise HTTPException(
            status_code=404,
            detail=f"account {account} not found in run {run_id}",
        )

    # BFS expansion up to `depth` hops, picking up neighbours in both directions.
    visited: set[str] = {account}
    frontier: set[str] = {account}
    truncated = False
    for _ in range(depth):
        if not frontier:
            break
        mask = df["Sender_account"].isin(frontier) | df["Receiver_account"].isin(
            frontier
        )
        neighbour_df = df[mask]
        new_nodes = (
            set(neighbour_df["Sender_account"].unique())
            | set(neighbour_df["Receiver_account"].unique())
        ) - visited
        if len(visited) + len(new_nodes) > _MAX_NODES:
            remaining = _MAX_NODES - len(visited)
            if remaining > 0:
                new_nodes = set(list(new_nodes)[:remaining])
            else:
                new_nodes = set()
            truncated = True
        visited.update(new_nodes)
        frontier = new_nodes
        if truncated:
            break

    # Keep only rows whose endpoints both sit in the visited set. This gives a
    # coherent subgraph even after the node cap kicks in.
    sub = df[
        df["Sender_account"].isin(visited) & df["Receiver_account"].isin(visited)
    ]

    edge_df = _aggregate_edges(sub)

    # Per-node transaction counts and flagged counts, from the subgraph rows.
    node_counts: dict[str, dict[str, int]] = {
        node: {"tx_count": 0, "flagged_count": 0} for node in visited
    }
    for col in ("Sender_account", "Receiver_account"):
        if col not in sub.columns:
            continue
        totals = sub.groupby(sub[col].astype(str)).size()
        for node_id, value in totals.items():
            if node_id in node_counts:
                node_counts[node_id]["tx_count"] += int(value)
        if "is_anomalous" in sub.columns:
            flagged = sub.groupby(sub[col].astype(str))["is_anomalous"].sum()
            for node_id, value in flagged.items():
                if node_id in node_counts:
                    node_counts[node_id]["flagged_count"] += int(value)

    nodes = [
        GraphNode(
            id=node,
            flagged_count=node_counts[node]["flagged_count"],
            tx_count=node_counts[node]["tx_count"],
        )
        for node in sorted(visited)
    ]

    edges = [
        GraphEdge(
            source=str(row["source"]),
            target=str(row["target"]),
            tx_count=int(row["tx_count"]),
            total_amount=float(row.get("total_amount", 0.0) or 0.0),
            any_flagged=bool(row.get("any_flagged", 0) or 0),
        )
        for _, row in edge_df.iterrows()
    ]

    return GraphResponse(
        run_id=run_id,
        account=account,
        depth=depth,
        nodes=nodes,
        edges=edges,
        truncated=truncated,
    )
