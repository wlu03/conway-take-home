import numpy as np
import pandas as pd
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
    MAD (Median Absolute Deviation) scoring — univariate, per feature.

    For each feature independently:
      MAD = median(|x - median(x)|)
      modified_z = 0.6745 * |x - median| / MAD

    The 0.6745 scaling factor makes MAD consistent with the standard
    deviation for normally distributed data (1/Phi^-1(0.75)).

    The final anomaly_score_mad is the maximum modified Z-score across
    all features for each transaction. A point is anomalous if it is
    an outlier in ANY single feature dimension.

    Limitation: MAD is univariate. it cannot detect anomalies that only
    appear when multiple features are considered together. Use MCD or
    Isolation Forest for multivariate detection.
    """
    X = df[features].copy().fillna(df[features].median())
    X_vals = X.values.astype(np.float64)

    medians = np.median(X_vals, axis=0)
    abs_dev = np.abs(X_vals - medians)
    mad = np.median(abs_dev, axis=0)

    # Avoid division by zero for constant features
    mad = np.where(mad == 0, 1e-6, mad)

    modified_z = 0.6745 * abs_dev / mad

    # Score = worst-case deviation across all features
    raw_scores = modified_z.max(axis=1)

    score_min, score_max = raw_scores.min(), raw_scores.max()
    df["anomaly_score_mad"] = raw_scores
    df["anomaly_score_mad_normalized"] = (raw_scores - score_min) / (score_max - score_min)

    print(f"MAD scoring complete. Score range: [{score_min:.4f}, {score_max:.4f}]")
    for p in [90, 95, 99, 99.5, 99.9]:
        print(f"  {p}th: {np.percentile(raw_scores, p):.4f}")

    return df


def score_mcd(
    df: pd.DataFrame,
    features: list = METRIC_FEATURES,
    support_fraction: float = 0.95,
    random_state: int = 42,
    sample_size: int = 10_000,
) -> tuple[pd.DataFrame, MinCovDet]:
    """
    MCD (Minimum Covariance Determinant) scoring, multivariate.

    MCD finds the subset of support_fraction * n observations whose
    covariance matrix has the smallest determinant (the 'tightest' cluster
    of inlier points). It then fits a robust covariance ellipsoid to that
    subset and scores all points by their Mahalanobis distance from the
    robust centroid.

    Mahalanobis distance accounts for feature correlations — a point that
    is 2 standard deviations out on each of two correlated features is less
    anomalous than one that is 2 standard deviations out on two independent
    features. This is the key advantage over MAD.

    Limitation: MCD assumes the inlier population forms a single ellipsoidal
    cluster (i.e., roughly multivariate Gaussian). For SAML-D, the inlier
    population is multimodal (cash deposits, wires, cheques each have different
    distributions), so MCD will misfit. Isolation Forest handles this better.

    FastMCD is O(n * p^2) where p is the number of features. At 9.5M rows
    this is infeasible, so we fit on a subsample and score the full dataset.
    support_fraction=0.95 means MCD fits to the 95% of points that form the
    most compact cluster, treating the other 5% as potential outliers during
    fitting.
    """
    X = df[features].copy().fillna(df[features].median())

    # MCD is expensive — fit on a representative subsample
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
