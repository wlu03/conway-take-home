"""
graph_features.py build a edge table from the full transaction history and computes 
per-account graph features using pandas merge ops 
"""

import pandas as pd
import numpy as np

GRAPH_FEATURE_COLS = [
    "in_any_cycle",
    "min_cycle_len",
    "scatter_source_count",
    "gather_target_count",
    "scatter_gather_score",
    "shared_counterparty_count",
]

## one row per (sender_acc, receiver_acc) pair 
def _build_edge_table(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df[["Sender_account", "Receiver_account"]].drop_duplicates().reset_index(drop=True)
    )

# Detected 2-hop or 3-hop cycles for every account
    # A → B → A: 2-hop
    # A → B → C → A: 3-hop
def add_cycle_features(df: pd.DataFrame) -> pd.DataFrame:
    edges = _build_edge_table(df)
    # 2-hop
    two_hop = edges.merge(
        edges,
        left_on="Receiver_account",
        right_on="Sender_account",
        suffixes=("_1", "_2"),
    )
    cycles_2 = two_hop[two_hop["Sender_account_1"] == two_hop["Receiver_account_2"]]
    cycle_2_accounts = set(cycles_2["Sender_account_1"]) | set(cycles_2["Receiver_account_1"])

    # 3-hop
    three_hop = two_hop.merge(
        edges,
        left_on="Receiver_account_2",
        right_on="Sender_account",
        suffixes=("", "_3"),
    ).rename(columns={"Receiver_account": "Receiver_account_3"})
    cycles_3 = three_hop[three_hop["Sender_account_1"] == three_hop["Receiver_account_3"]]
    cycle_3_accounts = (
        set(cycles_3["Sender_account_1"])
        | set(cycles_3["Receiver_account_1"])
        | set(cycles_3["Receiver_account_2"])
    )

    df["in_2hop_cycle"] = df["Sender_account"].isin(cycle_2_accounts).astype("int8")
    df["in_3hop_cycle"] = df["Sender_account"].isin(cycle_3_accounts).astype("int8")
    df["in_any_cycle"] = ((df["in_2hop_cycle"] == 1) | (df["in_3hop_cycle"] == 1)).astype("int8")

    # shortest cycle length
    df["min_cycle_len"] = np.where(
        df["in_2hop_cycle"] == 1, 2,
        np.where(df["in_3hop_cycle"] == 1, 3, 0)
    ).astype("int8")

    print(
        f"Cycle detection complete | "
        f"2-hop accounts: {len(cycle_2_accounts):,} | "
        f"3-hop accounts: {len(cycle_3_accounts):,}"
    )
    return df


def add_scatter_gather_features(df: pd.DataFrame) -> pd.DataFrame:
    edges = _build_edge_table(df)

    # identify the highest fan-out sender
        # comput how many unqiue recievers each sender has
        # for each sender account: count the number of distinct outgoing neighbors
        # this is fan out
    fan_out = (
        edges.groupby("Sender_account")["Receiver_account"]
        .nunique()
        .reset_index(rename={"Receiver_account": "fan_out"})
    )
    # pick the top 10% sender by fan out
    # scattter sources are account that send to many distinct receivers
    threshold = fan_out["fan_out"].quantile(0.90)
    scatter_sources = set(fan_out[fan_out["fan_out"] >= threshold]["Sender_account"])

    # how many high fan out senders send to it
    scatter_edges = edges[edges["Sender_account"].isin(scatter_sources)]
    scatter_source_count = (
        scatter_edges.groupby("Receiver_account")["Sender_account"]
        .nunique()
        .reset_index()
        .rename(columns={"Sender_account": "scatter_source_count", "Receiver_account": "account"})
    )

    # For each account, count how many of its senders' other receivers also send
    # to a common downstream target
    # find co-receivers (accounts sharing a sender)
    co_receivers = edges.merge(edges, on="Sender_account", suffixes=("_a", "_b"))
    co_receivers = co_receivers[co_receivers["Receiver_account_a"] != co_receivers["Receiver_account_b"]]

    # Check if co-receivers converge on a common downstream target
    co_receiver_targets = co_receivers.merge(
        edges,
        left_on="Receiver_account_b",
        right_on="Sender_account",
        suffixes=("", "_downstream"),
    )
    gather_count = (
        co_receiver_targets.groupby("Receiver_account_a")["Receiver_account"]
        .nunique()
        .reset_index()
        .rename(columns={"Receiver_account_a": "account", "Receiver_account": "gather_target_count"})
    )

    # Merge features back onto the main dataframe via Sender_account
    df = df.merge(
        scatter_source_count.rename(columns={"account": "Sender_account"}),
        on="Sender_account", how="left",
    )
    df = df.merge(
        gather_count.rename(columns={"account": "Sender_account"}),
        on="Sender_account", how="left",
    )
    df["scatter_source_count"] = df["scatter_source_count"].fillna(0).astype("int32")
    df["gather_target_count"] = df["gather_target_count"].fillna(0).astype("int32")

    # Normalise each to [0,1] then multiply for a combined score
    ssc_max = df["scatter_source_count"].max() or 1
    gtc_max = df["gather_target_count"].max() or 1
    df["scatter_gather_score"] = (
        (df["scatter_source_count"] / ssc_max) *
        (df["gather_target_count"] / gtc_max)
    ).astype("float32")

    print(
        f"Scatter-Gather detection complete | "
        f"scatter sources: {len(scatter_sources):,} | "
        f"accounts with scatter_source_count > 0: "
        f"{(df['scatter_source_count'] > 0).sum():,}"
    )
    return df

# compute howm any counterparties have bidriectional ties to an account
def add_shared_counterparty_features(df: pd.DataFrame) -> pd.DataFrame:
    edges = _build_edge_table(df)

    senders = set(zip(edges["Receiver_account"], edges["Sender_account"]))  # (account, who sends to it)
    receivers = set(zip(edges["Sender_account"], edges["Receiver_account"]))  # (account, who it sends to)

    # Overlap: third parties that appear in both sets for the same account
    overlap = senders & receivers  # (account, counterparty) pairs where money flows both ways
    if overlap:
        overlap_df = pd.DataFrame(list(overlap), columns=["account", "counterparty"])
        shared_counts = (
            overlap_df.groupby("account")["counterparty"]
            .nunique()
            .reset_index()
            .rename(columns={"counterparty": "shared_counterparty_count"})
        )
    else:
        shared_counts = pd.DataFrame(columns=["account", "shared_counterparty_count"])

    df = df.merge(
        shared_counts.rename(columns={"account": "Sender_account"}),
        on="Sender_account", how="left",
    )
    df["shared_counterparty_count"] = df["shared_counterparty_count"].fillna(0).astype("int32")

    print(
        f"Shared counterparty detection complete | "
        f"accounts with bidirectional ties: "
        f"{(df['shared_counterparty_count'] > 0).sum():,}"
    )
    return df

def add_graph_features(df: pd.DataFrame) -> pd.DataFrame:
    print("Building graph features")
    df = add_cycle_features(df)
    df = add_scatter_gather_features(df)
    df = add_shared_counterparty_features(df)
    print("Graph features complete.")
    return df
