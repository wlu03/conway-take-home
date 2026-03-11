import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.covariance import MinCovDet
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
    # graph-level features (cycle and scatter-gather detection)
    "in_any_cycle",
    "min_cycle_len",
    "scatter_source_count",
    "gather_target_count",
    "scatter_gather_score",
    "shared_counterparty_count",
]

## Score each transaction with Isolation Forest
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

def score_mad(df: pd.DataFrame,
    features: list = METRIC_FEATURES,
) -> pd.DataFrame:
    """
    MAD scoring: univariate, per feature.

    For each feature independently:
      MAD = median(|x - median(x)|)
      modified_z = 0.6745 * |x - median| / MAD

    The 0.6745 scaling factor makes MAD consistent with the standard
    deviation for normally distributed data (1/Phi^-1(0.75)).

    The final anomaly_score_mad is the maximum modified Z-score across
    all features for each transaction. A point is anomalous if it is
    an outlier in ANY single feature dimension.
    """
    X = df[features].copy().fillna(df[features].median())
    X_vals = X.values.astype(np.float64)

    medians = np.median(X_vals, axis=0)
    abs_dev = np.abs(X_vals - medians)
    mad = np.median(abs_dev, axis=0)

    # Avoid division by zero for constant features
    mad = np.where(mad == 0, 1e-6, mad)

    # Only score features where MAD > 0; zero-MAD (constant) features carry no signal
    valid = mad > 0
    modified_z = np.zeros_like(abs_dev)
    modified_z[:, valid] = 0.6745 * abs_dev[:, valid] / mad[valid]

    # Score = worst-case deviation across all valid features
    raw_scores = modified_z[:, valid].max(axis=1)

    score_min, score_max = raw_scores.min(), raw_scores.max()
    df["anomaly_score_mad"] = raw_scores
    df["anomaly_score_mad_normalized"] = (raw_scores - score_min) / (score_max - score_min)

    print(f"MAD scoring complete. Score range: [{score_min:.4f}, {score_max:.4f}]")
    for p in [90, 95, 99, 99.5, 99.9]:
        print(f"  {p}th: {np.percentile(raw_scores, p):.4f}")

    mad_params = {"medians": medians, "mads": mad}
    return df, mad_params


def score_mcd(
    df: pd.DataFrame,
    features: list = METRIC_FEATURES,
    support_fraction: float = 0.95,
    random_state: int = 42,
    sample_size: int = 10_000,
) -> tuple[pd.DataFrame, MinCovDet]:
    """
    MCD: scoring, multivariate.

    MCD finds the subset of support_fraction * n observations whose
    covariance matrix has the smallest determinant (the 'tightest' cluster
    of inlier points). It then fits a robust covariance ellipsoid to that
    subset and scores all points by their Mahalanobis distance from the
    robust centroid.

    Mahalanobis distance accounts for feature correlations, a point that
    is 2 standard deviations out on each of two correlated features is less
    anomalous than one that is 2 standard deviations out on two independent
    features. This is the key advantage over MAD.
    """
    X = df[features].copy().fillna(df[features].median())

    # MCD is expensive thus fit on a representative subsample
    sample_idx = np.random.default_rng(random_state).choice(len(X), size=min(sample_size, len(X)), replace=False)
    X_sample = X.iloc[sample_idx].values.astype(np.float64)

    print(f"Fitting MinCovDet on {len(X_sample):,} sampled transactions...")
    mcd = MinCovDet(support_fraction=support_fraction, random_state=random_state)
    mcd.fit(X_sample)

    # Score all rows: mahalanobis() returns squared distances
    print(f"Scoring {len(X):,} transactions via Mahalanobis distance...")
    raw_scores = mcd.mahalanobis(X.values.astype(np.float64))  # squared distances

    score_min, score_max = raw_scores.min(), raw_scores.max()
    df["anomaly_score_mcd"] = raw_scores
    df["anomaly_score_mcd_normalized"] = (raw_scores - score_min) / (score_max - score_min)

    print(f"MCD scoring complete. Score range: [{score_min:.4f}, {score_max:.4f}]")
    for p in [90, 95, 99, 99.5, 99.9]:
        print(f"  {p}th: {np.percentile(raw_scores, p):.4f}")

    return df, mcd


def save_models(
    path: str,
    clf: IsolationForest,
    scaler: StandardScaler,
    mcd: MinCovDet,
    mad_params: dict,
    cutoff: float,
    features: list,
) -> None:
    """
    Persist all trained scoring objects to disk so they can be reloaded
    for inference on a new CSV without retraining.

    Saves:
      clf         — fitted IsolationForest
      scaler      — fitted StandardScaler (must be applied before clf)
      mcd         — fitted MinCovDet
      mad_params  — dict with 'medians' and 'mads' arrays from score_mad
      cutoff      — anomaly_score threshold from classify_transactions
      features    — ordered list of feature column names the models expect
    """
    out = Path(path)
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf,        out / "isolation_forest.joblib")
    joblib.dump(scaler,     out / "scaler.joblib")
    joblib.dump(mcd,        out / "mcd.joblib")
    joblib.dump(mad_params, out / "mad_params.joblib")
    joblib.dump({"cutoff": cutoff, "features": features}, out / "meta.joblib")
    print(f"Models saved to {out}/")


def load_models(path: str) -> dict:
    """
    Load all trained scoring objects from disk.
    Returns a dict with keys: clf, scaler, mcd, mad_params, cutoff, features.
    """
    out = Path(path)
    meta = joblib.load(out / "meta.joblib")
    return {
        "clf":        joblib.load(out / "isolation_forest.joblib"),
        "scaler":     joblib.load(out / "scaler.joblib"),
        "mcd":        joblib.load(out / "mcd.joblib"),
        "mad_params": joblib.load(out / "mad_params.joblib"),
        "cutoff":     meta["cutoff"],
        "features":   meta["features"],
    }


def apply_scores(
    df: pd.DataFrame,
    clf: IsolationForest,
    scaler: StandardScaler,
    mcd: MinCovDet,
    mad_params: dict,
    features: list,
    cutoff: float,
) -> pd.DataFrame:
    """
    Apply pre-trained models to a new dataframe for inference.

    Adds the same score columns as the training functions:
      anomaly_score, anomaly_score_normalized
      anomaly_score_mad, anomaly_score_mad_normalized
      anomaly_score_mcd, anomaly_score_mcd_normalized
      is_anomalous  (1 if anomaly_score >= cutoff, else 0)
    """
    X = df[features].copy().fillna(df[features].median())

    # Isolation Forest
    X_scaled = scaler.transform(X)
    df["anomaly_score"] = -clf.score_samples(X_scaled)
    score_min = df["anomaly_score"].min()
    score_max = df["anomaly_score"].max()
    df["anomaly_score_normalized"] = (df["anomaly_score"] - score_min) / (score_max - score_min)

    # MAD: apply stored medians and MADs from training data
    X_vals = X.values.astype(np.float64)
    medians = mad_params["medians"]
    mads    = mad_params["mads"]
    modified_z = 0.6745 * np.abs(X_vals - medians) / mads
    raw_mad = modified_z.max(axis=1)
    df["anomaly_score_mad"] = raw_mad
    df["anomaly_score_mad_normalized"] = (raw_mad - raw_mad.min()) / (raw_mad.max() - raw_mad.min())

    # MCD
    raw_mcd = mcd.mahalanobis(X.values.astype(np.float64))
    df["anomaly_score_mcd"] = raw_mcd
    df["anomaly_score_mcd_normalized"] = (raw_mcd - raw_mcd.min()) / (raw_mcd.max() - raw_mcd.min())

    # Classify using the stored cutoff from training
    df["is_anomalous"] = (df["anomaly_score"] >= cutoff).astype("int8")
    print(
        f"Inference complete | {df['is_anomalous'].sum():,} flagged "
        f"({df['is_anomalous'].mean() * 100:.3f}% of {len(df):,})"
    )
    return df


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
