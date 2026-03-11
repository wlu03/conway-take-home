import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


METRIC_FEATURES = [
    "log_amount",
    "sender_tx_count",
    "sender_fan_out_ratio",
    "sender_amount_cv",
    "receiver_fan_in_ratio",
    "time_since_last_tx_hours",
    "is_currency_conversion",
    "any_high_risk",
    "just_below_10k",
    "below_10k_margin",
    "sender_unique_receiver_countries",
]

"""Score each transaction with Isolation Forest"""
def score_transactions(
    df: pd.DataFrame,
    features: list = METRIC_FEATURES,
    contamination: float = 0.01, # expected fraciton of outliers (1% greater than the true 0.1% rate in paper)
    n_estimators: int = 100, # paper mentions diminshing returns after this
    sample_size: int = 256, # paper recommendations, larger tree subsample increase trainng time 
    random_state: int = 42,
) -> tuple[pd.DataFrame, IsolationForest, StandardScaler]:

    X = df[features].copy()
    X = X.fillna(X.median())
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"Training Isolation Forest on {len(X):,} transactions")
    clf = IsolationForest(
        n_estimators=n_estimators,
        max_samples=sample_size,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
        verbose=1,
    )
    clf.fit(X_scaled)

    # score_samples returns negative anomaly scores
        # more negative = more anomalous
        # negate where the higher anomaly_score means higher likelihood of fraud
    df["anomaly_score"] = -clf.score_samples(X_scaled)

    score_min = df["anomaly_score"].min()
    score_max = df["anomaly_score"].max()
    df["anomaly_score_normalized"] = (df["anomaly_score"] - score_min) / (score_max - score_min)

    print(f"Scoring complete. Score range: [{score_min:.4f}, {score_max:.4f}]")
    print("Score percentiles:")
    for p in [90, 95, 99, 99.5, 99.9]:
        print(f" {p}th: {np.percentile(df['anomaly_score'], p):.4f}")
    return df, clf, scaler

def score_in_chunks(df: pd.DataFrame, features: list = METRIC_FEATURES, chunk_size: int = 500_000, random_state: int = 42,) -> tuple[pd.DataFrame, IsolationForest, StandardScaler]:
    """
    Train on a sample, score in chunks
    Use rows won't fit in RAM after feature engineering
    """
    sample = df.sample(n=min(1_000_000, len(df)), random_state=random_state)
    X_sample = sample[features].fillna(sample[features].median())

    scaler = StandardScaler()
    X_sample_scaled = scaler.fit_transform(X_sample)

    clf = IsolationForest(
        n_estimators=100,
        max_samples=256,
        contamination=0.01,
        random_state=random_state,
        n_jobs=-1,
    )
    clf.fit(X_sample_scaled)

    scores = []
    for start in range(0, len(df), chunk_size):
        chunk = df.iloc[start : start + chunk_size][features].fillna(0)
        X_chunk = scaler.transform(chunk)
        scores.extend(-clf.score_samples(X_chunk))
        print(f"Scored {start + len(chunk):,} / {len(df):,}")

    df["anomaly_score"] = scores
    return df, clf, scaler
