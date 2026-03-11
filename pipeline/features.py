import numpy as np
import pandas as pd
FATF_BlackList_February_2026 = {
    "Iran",
    "Myanmar",
    "North Korea"
}

FATF_Grey_List_February_2026 = {
    "Algeria",
    "Angola",
    "Bolivia",
    "Bulgaria",
    "Cameroon",
    "Côte d'Ivoire",
    "Democratic Republic of the Congo",
    "Haiti",
    "Kenya",
    "Kuwait",
    "Lao PDR",
    "Lebanon",
    "Monaco",
    "Namibia",
    "Nepal",
    "Papua New Guinea",
    "South Sudan",
    "Syria",
    "Venezuela",
    "Vietnam",
    "Virgin Islands (UK)",
    "Yemen"
}


"""Compute features that depend only on the single transaction row."""
def add_transaction_features(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()
    # ensure there is a datetime column for time‑based features; some datasets
    # store date/time separately, so combine them if necessary
    if "DateTime" not in df.columns:
        if "Date" in df.columns and "Time" in df.columns:
            df["DateTime"] = pd.to_datetime(df["Date"].astype(str) + " " + df["Time"].astype(str))
        else:
            raise KeyError("DataFrame must contain a 'DateTime' column or both 'Date' and 'Time' to construct one")

    ## currency features
    df["log_amount"] = np.log1p(df["Amount"].astype("float64")) 
    df["is_currency_conversion"] = (df["Payment_currency"] != df["Received_currency"]).astype("int8")
    
    # FATF risks features for blacklist and greylist countries
    df["sender_blacklist"] = df["Sender_bank_location"].isin(FATF_BlackList_February_2026).astype("int8")
    df["sender_greylist"] = df["Sender_bank_location"].isin(FATF_Grey_List_February_2026).astype("int8")
    df["receiver_blacklist"] = df["Receiver_bank_location"].isin(FATF_BlackList_February_2026).astype("int8")
    df["receiver_greylist"] = df["Receiver_bank_location"].isin(FATF_Grey_List_February_2026).astype("int8")
    
    # High risk features
    df["sender_high_risk"] = (df["sender_blacklist"] | df["sender_greylist"]).astype("int8")
    df["receiver_high_risk"] = (df["receiver_blacklist"] | df["receiver_greylist"]).astype("int8")
    df["any_high_risk"] = (df["sender_high_risk"] | df["receiver_high_risk"]).astype("int8")
    
    # Suspcious Activity Reports (SARs):
        # 5000 - Financial Institutions must file a SAR if a transaction involves 5000+
        # 2000 - Lower SAR threshold for money service businesses MSs
    # IRS / Tax Reporitng
        # 10000 - Must be reported. via Form 8300 
        # 600 - Third party platforms (like PayPal,Venmo) must issue 1099-K but can be ignore for this 
    # FATCA/International
        # 50k-600k Must report form 8938 
    amount = df["Amount"].astype("float64")
    for threshold in [2_000, 5_000, 10_000, 50_000]:
        lower = threshold * 0.90
        col_prefix = f"below_{threshold // 1000}k"
        df[f"just_{col_prefix}"] = ((amount >= lower) & (amount < threshold)).astype("int8")
        df[f"{col_prefix}_margin"] = (((threshold - amount) / threshold).clip(0, 1).where(amount < threshold, 0))

    df["is_off_hours"] = ((df["DateTime"].dt.hour < 9) | (df["DateTime"].dt.hour >= 18)).astype("int8")
    df["is_weekend"] = (df["DateTime"].dt.dayofweek >= 5).astype("int8")

    return df


"""Compute features that depend on behavior over time and across many transactions"""
def add_account_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy().sort_values("DateTime")

    sender_grp = df.groupby("Sender_account", sort=False) # treats all rows with the same sender as a group
    # create summary per sender account
    sender_stats = sender_grp.agg(
        _sender_transaction_count=("Receiver_account", "count"),
        _sender_unique_receivers=("Receiver_account", "nunique"),
        _sender_amount_mean=("Amount", "mean"),
        _sender_amount_std=("Amount", "std"),
        _sender_unique_countries=("Receiver_bank_location", "nunique"),
    ).reset_index()

    sender_stats["sender_fan_out_ratio"] = (sender_stats["_sender_unique_receivers"] / sender_stats["_sender_transaction_count"])
    
    sender_stats["sender_amount_cv"] = (sender_stats["_sender_amount_std"] / sender_stats["_sender_amount_mean"]).fillna(0)
    sender_stats["sender_unique_receiver_countries"] = sender_stats["_sender_unique_countries"]

    sender_stats = sender_stats[["Sender_account", "sender_fan_out_ratio", "sender_amount_cv", "sender_unique_receiver_countries"]]
    df = df.merge(sender_stats, on="Sender_account", how="left")

    # Receiver Groups
    receiver_grp = df.groupby("Receiver_account", sort=False)
    receiver_stats = receiver_grp.agg(
        _receiver_tx_count=("Sender_account", "count"),
        _receiver_unique_senders=("Sender_account", "nunique"),
    ).reset_index()

    receiver_stats["receiver_fan_in_ratio"] = (receiver_stats["_receiver_unique_senders"] / receiver_stats["_receiver_tx_count"])
    receiver_stats = receiver_stats[["Receiver_account", "receiver_fan_in_ratio"]]
    df = df.merge(receiver_stats, on="Receiver_account", how="left")

    # Time since last transaction (per sender, in hours)
    df["time_since_last_tx_hours"] = (
        df.groupby("Sender_account")["DateTime"]
        .diff()
        .dt.total_seconds()
        .div(3600)
    )

    df["time_since_last_tx_hours"] = df["time_since_last_tx_hours"].fillna(999)
    return df

FEATURE_COLS = [
    "log_amount",
    "is_currency_conversion",
    "sender_high_risk",
    "receiver_high_risk",
    "any_high_risk",
    "just_below_2k",
    "below_2k_margin",
    "just_below_5k",
    "below_5k_margin",
    "just_below_10k",
    "below_10k_margin",
    "just_below_50k",
    "below_50k_margin",
    "is_off_hours",
    "is_weekend",
    "sender_fan_out_ratio",
    "sender_amount_cv",
    "sender_unique_receiver_countries",
    "receiver_fan_in_ratio",
    "time_since_last_tx_hours",
    # graph-level features
    "in_any_cycle",
    "min_cycle_len",
    "scatter_source_count",
    "gather_target_count",
    "scatter_gather_score",
    "shared_counterparty_count",
]


def build_features(df: pd.DataFrame, include_graph: bool = True) -> pd.DataFrame:
    df = add_transaction_features(df)
    df = add_account_features(df)
    if include_graph:
        from pipeline.graph_features import add_graph_features
        df = add_graph_features(df)
    return df
