"""
Empirical Deep Dive on the Scored AML Pipeline Output.

Runs a battery of diagnostics on an already-scored parquet that contains all
engineered features + the three anomaly scores (IF, MAD, MCD) and the
`is_anomalous` flag from the production pipeline. Ground-truth labels are
re-attached from the source CSV at row-index granularity (row order was
preserved during scoring).

Outputs text tables to stdout and writes intermediate result parquets /
CSVs under docs/analysis/ for the markdown writeup step.

All paths are absolute so the script is safely runnable from anywhere.
"""

from __future__ import annotations

import gc
import json
import os
import sys
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from scipy.stats import pearsonr, spearmanr
from sklearn.inspection import permutation_importance

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Absolute paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path("/Users/wesleylu/Desktop/fraud-detection")
PARQUET_PATH = REPO_ROOT / "web/api/data/runs/7df86fd4288347e2.parquet"
LABELS_CSV = REPO_ROOT / "data/transactions_with_labels.csv"
MODELS_DIR = REPO_ROOT / "models"
ANALYSIS_DIR = REPO_ROOT / "docs/analysis"
FIG_DIR = ANALYSIS_DIR / "figures"
RESULTS_DIR = ANALYSIS_DIR / "results"

for d in (ANALYSIS_DIR, FIG_DIR, RESULTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Make the pipeline package importable without modifying sys.path permanently
# (the caller may run this script from anywhere).
sys.path.insert(0, str(REPO_ROOT))
from pipeline.score import METRIC_FEATURES, load_models  # noqa: E402

RANDOM_STATE = 42
IF_SAMPLE_N = 200_000  # permutation-importance sample size
FP_PROFILE_SAMPLE_N = 1_000_000  # sample used for the false-positive profiling


def _timed(label):
    def _decorator(fn):
        def _wrapped(*a, **kw):
            t0 = time.time()
            print(f"\n--- {label} ---", flush=True)
            out = fn(*a, **kw)
            print(f"({label} done in {time.time() - t0:.1f}s)", flush=True)
            return out

        return _wrapped

    return _decorator


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
@_timed("Loading scored parquet")
def load_scored() -> pd.DataFrame:
    # Only read the columns we need. METRIC_FEATURES + score columns + a flag.
    score_cols = [
        "anomaly_score",
        "anomaly_score_normalized",
        "anomaly_score_mad",
        "anomaly_score_mad_normalized",
        "anomaly_score_mcd",
        "anomaly_score_mcd_normalized",
        "is_anomalous",
    ]
    pf = pq.ParquetFile(PARQUET_PATH)
    available = set(pf.schema_arrow.names)
    wanted = [c for c in METRIC_FEATURES + score_cols if c in available]
    missing = [c for c in METRIC_FEATURES + score_cols if c not in available]
    if missing:
        print(f"  WARNING: missing columns in parquet: {missing}", flush=True)
    df = pf.read(columns=wanted).to_pandas()
    print(f"  rows={len(df):,}  cols={df.shape[1]}", flush=True)
    return df


@_timed("Attaching ground-truth labels")
def attach_labels(df: pd.DataFrame) -> pd.DataFrame:
    # Read only the two label columns. Row order is preserved.
    labels = pd.read_csv(
        LABELS_CSV,
        usecols=["Is_laundering", "Laundering_type"],
        dtype={"Is_laundering": "int8", "Laundering_type": "category"},
    )
    print(f"  labels rows={len(labels):,}", flush=True)
    if len(labels) != len(df):
        raise RuntimeError(
            f"Row count mismatch: parquet={len(df):,} labels={len(labels):,}. "
            "Cannot re-attach by index."
        )
    df["Is_laundering"] = labels["Is_laundering"].values
    df["Laundering_type"] = labels["Laundering_type"].values
    print(
        f"  positives in population: "
        f"{int(df['Is_laundering'].sum()):,} ({df['Is_laundering'].mean() * 100:.3f}%)",
        flush=True,
    )
    return df


# ---------------------------------------------------------------------------
# 1. Permutation importance on Isolation Forest
# ---------------------------------------------------------------------------
@_timed("Permutation importance on Isolation Forest")
def permutation_importance_if(df: pd.DataFrame) -> pd.DataFrame:
    models = load_models(str(MODELS_DIR))
    clf = models["clf"]
    scaler = models["scaler"]
    features = models["features"]

    # Stratify on `is_anomalous`: sqrt(N) split → make it 50/50 between classes
    # for strong statistical power on the small positive class.
    half = IF_SAMPLE_N // 2
    pos = df[df["is_anomalous"] == 1]
    neg = df[df["is_anomalous"] == 0]
    n_pos = min(half, len(pos))
    n_neg = IF_SAMPLE_N - n_pos
    pos_s = pos.sample(n=n_pos, random_state=RANDOM_STATE)
    neg_s = neg.sample(n=n_neg, random_state=RANDOM_STATE)
    sample = pd.concat([pos_s, neg_s], ignore_index=True)
    print(f"  sample n={len(sample):,}  pos={n_pos}  neg={n_neg}", flush=True)

    X = sample[features].fillna(sample[features].median()).astype("float64")
    X_scaled = scaler.transform(X)

    # score_samples: HIGHER == more normal. permutation_importance with a custom
    # scoring callable expects (estimator, X, y) → scalar; we use the mean
    # score_samples as the "inlier-ness" score. Shuffling a useful feature
    # SHOULD drop mean score_samples (rows look more anomalous), so the
    # importance is positive.
    def _scorer(estimator, X_in, y_unused):
        return estimator.score_samples(X_in).mean()

    r = permutation_importance(
        clf,
        X_scaled,
        y=np.zeros(len(X_scaled)),  # unused by our scorer
        scoring=_scorer,
        n_repeats=5,
        random_state=RANDOM_STATE,
        n_jobs=1,  # IsolationForest.score_samples already uses threads
    )
    result = pd.DataFrame(
        {
            "feature": features,
            "importance_mean": r.importances_mean,
            "importance_std": r.importances_std,
        }
    ).sort_values("importance_mean", ascending=False)
    result["rank"] = np.arange(1, len(result) + 1)
    print(result.to_string(index=False), flush=True)
    result.to_csv(RESULTS_DIR / "01_permutation_importance.csv", index=False)
    return result


# ---------------------------------------------------------------------------
# 2. Per-typology confusion at top 1%
# ---------------------------------------------------------------------------
@_timed("Per-typology confusion at top 1%")
def typology_confusion(df: pd.DataFrame) -> pd.DataFrame:
    groups = df.groupby("Laundering_type", observed=True)
    rows = []
    total_pos = int(df["Is_laundering"].sum())
    total_neg = len(df) - total_pos
    for typ, g in groups:
        total = len(g)
        flagged = int(g["is_anomalous"].sum())
        true_positives_in_typ = int(g["Is_laundering"].sum())  # labelled positives within this typology
        tp_flagged = int(((g["is_anomalous"] == 1) & (g["Is_laundering"] == 1)).sum())
        fp_flagged = int(((g["is_anomalous"] == 1) & (g["Is_laundering"] == 0)).sum())
        recall = tp_flagged / true_positives_in_typ if true_positives_in_typ > 0 else float("nan")
        precision_in_typ = tp_flagged / flagged if flagged > 0 else float("nan")
        rows.append(
            {
                "typology": str(typ),
                "is_labelled_laundering": bool(true_positives_in_typ > 0),
                "count": total,
                "pct_of_population": total / len(df),
                "flagged": flagged,
                "flagged_rate": flagged / total,
                "tp_flagged": tp_flagged,
                "fp_flagged": fp_flagged,
                "recall": recall,
                "precision_in_typology": precision_in_typ,
            }
        )
    tbl = pd.DataFrame(rows).sort_values(
        ["is_labelled_laundering", "recall"], ascending=[False, False]
    )
    print(tbl.to_string(index=False), flush=True)
    tbl.to_csv(RESULTS_DIR / "02_typology_confusion.csv", index=False)
    return tbl


# ---------------------------------------------------------------------------
# 3. Correlation and disagreement among the three normalized scores
# ---------------------------------------------------------------------------
@_timed("Score correlation and disagreement")
def score_agreement(df: pd.DataFrame) -> dict:
    # Full-population correlation is cheap on 9.5M rows but Spearman on the
    # whole set is too slow; sample 500k.
    samp = df[["anomaly_score_normalized", "anomaly_score_mad_normalized", "anomaly_score_mcd_normalized", "Is_laundering"]].sample(
        n=500_000, random_state=RANDOM_STATE
    )
    cols = {
        "IF": "anomaly_score_normalized",
        "MAD": "anomaly_score_mad_normalized",
        "MCD": "anomaly_score_mcd_normalized",
    }
    names = list(cols.keys())
    pearson = pd.DataFrame(index=names, columns=names, dtype=float)
    spearman = pd.DataFrame(index=names, columns=names, dtype=float)
    for a in names:
        for b in names:
            pearson.loc[a, b] = pearsonr(samp[cols[a]], samp[cols[b]])[0]
            spearman.loc[a, b] = spearmanr(samp[cols[a]], samp[cols[b]])[0]
    print("Pearson:\n", pearson.round(3).to_string(), flush=True)
    print("Spearman:\n", spearman.round(3).to_string(), flush=True)

    # Flagged sets at top 1% (computed on the full 9.5M rows, stored as masks)
    thresholds = {}
    flag = {}
    for name, col in cols.items():
        t = np.percentile(df[col], 99.0)
        thresholds[name] = float(t)
        flag[name] = df[col].values >= t

    n = len(df)
    all_three = np.logical_and.reduce(list(flag.values()))
    any_one = np.logical_or.reduce(list(flag.values()))
    only_if = flag["IF"] & ~flag["MAD"] & ~flag["MCD"]
    only_mad = flag["MAD"] & ~flag["IF"] & ~flag["MCD"]
    only_mcd = flag["MCD"] & ~flag["IF"] & ~flag["MAD"]
    exactly_two = (
        (flag["IF"].astype(int) + flag["MAD"].astype(int) + flag["MCD"].astype(int)) == 2
    )

    labels = df["Is_laundering"].values
    summary = {
        "thresholds_top1pct": thresholds,
        "flagged_counts": {k: int(v.sum()) for k, v in flag.items()},
        "flagged_by_all_three": int(all_three.sum()),
        "flagged_by_any": int(any_one.sum()),
        "only_if": int(only_if.sum()),
        "only_mad": int(only_mad.sum()),
        "only_mcd": int(only_mcd.sum()),
        "exactly_two": int(exactly_two.sum()),
        "all_three_precision": float(labels[all_three].mean()) if all_three.sum() else 0.0,
        "only_if_precision": float(labels[only_if].mean()) if only_if.sum() else 0.0,
        "only_mad_precision": float(labels[only_mad].mean()) if only_mad.sum() else 0.0,
        "only_mcd_precision": float(labels[only_mcd].mean()) if only_mcd.sum() else 0.0,
        "any_precision": float(labels[any_one].mean()) if any_one.sum() else 0.0,
    }

    # Recall from each flagger over the full-population positives
    total_pos = int(labels.sum())
    summary["total_positives"] = total_pos
    summary["recall_by_flagger"] = {
        k: float(labels[flag[k]].sum() / total_pos) if total_pos else 0.0
        for k in names
    }
    summary["recall_all_three"] = float(labels[all_three].sum() / total_pos) if total_pos else 0.0
    summary["recall_any"] = float(labels[any_one].sum() / total_pos) if total_pos else 0.0

    print(json.dumps(summary, indent=2, default=float), flush=True)
    pearson.to_csv(RESULTS_DIR / "03_pearson.csv")
    spearman.to_csv(RESULTS_DIR / "03_spearman.csv")
    with open(RESULTS_DIR / "03_agreement_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=float)
    return summary


# ---------------------------------------------------------------------------
# 4. False-positive profiling
# ---------------------------------------------------------------------------
@_timed("False-positive profiling")
def fp_profile(df: pd.DataFrame) -> dict:
    sample = df.sample(n=min(FP_PROFILE_SAMPLE_N, len(df)), random_state=RANDOM_STATE).copy()
    sample["label"] = "TN"
    sample.loc[(sample["is_anomalous"] == 1) & (sample["Is_laundering"] == 1), "label"] = "TP"
    sample.loc[(sample["is_anomalous"] == 1) & (sample["Is_laundering"] == 0), "label"] = "FP"
    sample.loc[(sample["is_anomalous"] == 0) & (sample["Is_laundering"] == 1), "label"] = "FN"

    # (a) Typology dominance among the false positives (scope-free — use the full df, not a sample)
    full_fp = df[(df["is_anomalous"] == 1) & (df["Is_laundering"] == 0)]
    fp_typ = (
        full_fp["Laundering_type"]
        .value_counts(dropna=False)
        .rename("fp_count")
        .to_frame()
        .reset_index(drop=False)
        .rename(columns={"index": "typology"})
    )
    # Some pandas versions keep the col as "Laundering_type"
    if "Laundering_type" in fp_typ.columns:
        fp_typ = fp_typ.rename(columns={"Laundering_type": "typology"})
    fp_typ["share_of_fp"] = fp_typ["fp_count"] / full_fp.shape[0]
    fp_typ["population_count"] = fp_typ["typology"].map(
        df["Laundering_type"].value_counts()
    )
    fp_typ["fp_rate_within_typology"] = fp_typ["fp_count"] / fp_typ["population_count"]
    fp_typ = fp_typ.sort_values("fp_count", ascending=False).head(15)
    print("\nFP dominance by typology (top 15):")
    print(fp_typ.to_string(index=False), flush=True)
    fp_typ.to_csv(RESULTS_DIR / "04a_fp_typology_dominance.csv", index=False)

    # (b) Per-bucket feature means (TP, FP, TN, FN) on the sample
    feats = [f for f in METRIC_FEATURES if f in sample.columns]
    bucket_means = (
        sample.groupby("label", observed=True)[feats]
        .mean()
        .T
    )
    # Compute a simple "TP vs FP discrimination" signal: (mean_TP - mean_FP) /
    # pooled std. High |z| means the feature separates true from false flags.
    pooled_std = sample[feats].std().replace(0, np.nan)
    if "TP" in bucket_means.columns and "FP" in bucket_means.columns:
        bucket_means["tp_minus_fp"] = bucket_means["TP"] - bucket_means["FP"]
        bucket_means["tp_vs_fp_z"] = bucket_means["tp_minus_fp"] / pooled_std
    bucket_means = bucket_means.sort_values("tp_vs_fp_z", key=np.abs, ascending=False)
    print("\nPer-bucket feature means (sorted by |TP-FP|/pooled_std):")
    print(bucket_means.round(4).to_string(), flush=True)
    bucket_means.to_csv(RESULTS_DIR / "04b_bucket_feature_means.csv")

    label_counts = sample["label"].value_counts().to_dict()
    print(f"\nSample label counts: {label_counts}", flush=True)
    with open(RESULTS_DIR / "04c_label_counts_sample.json", "w") as f:
        json.dump({k: int(v) for k, v in label_counts.items()}, f, indent=2)
    return {"bucket_means": bucket_means, "fp_typologies": fp_typ, "sample_counts": label_counts}


# ---------------------------------------------------------------------------
# 5. Threshold sensitivity for the four primary typologies
# ---------------------------------------------------------------------------
TARGET_TYPOLOGIES = ["Structuring", "Scatter-Gather", "Cycle", "Smurfing"]


@_timed("Threshold sensitivity for primary typologies")
def threshold_sensitivity(df: pd.DataFrame) -> pd.DataFrame:
    pcts = [0.1, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 7.5, 10.0]
    score = df["anomaly_score"].values

    rows = []
    for pct in pcts:
        cutoff = np.percentile(score, 100 - pct)
        flagged_mask = score >= cutoff
        n_flagged = int(flagged_mask.sum())
        row = {"pct_flagged": pct, "n_flagged": n_flagged}
        # Overall precision / recall
        y = df["Is_laundering"].values
        tp = int(((flagged_mask) & (y == 1)).sum())
        row["overall_precision"] = tp / n_flagged if n_flagged else float("nan")
        row["overall_recall"] = tp / int(y.sum()) if y.sum() else float("nan")
        # Per-typology recall
        for typ in TARGET_TYPOLOGIES:
            mask = (df["Laundering_type"] == typ) & (df["Is_laundering"] == 1)
            total = int(mask.sum())
            hits = int((flagged_mask & mask.values).sum()) if total else 0
            row[f"recall_{typ}"] = hits / total if total else float("nan")
            row[f"positives_{typ}"] = total
        rows.append(row)
    tbl = pd.DataFrame(rows)
    print(tbl.round(4).to_string(index=False), flush=True)
    tbl.to_csv(RESULTS_DIR / "05_threshold_sensitivity.csv", index=False)
    return tbl


# ---------------------------------------------------------------------------
# 6. Score distribution by typology for labelled positives
# ---------------------------------------------------------------------------
@_timed("Score distribution by typology (labelled positives)")
def score_dist_by_typology(df: pd.DataFrame, typology_confusion_tbl: pd.DataFrame) -> pd.DataFrame:
    # Pick the 6 typologies with the highest recall (true laundering only),
    # plus "Smurfing" if not already in. Ignore NaN recalls.
    tp_sub = typology_confusion_tbl[typology_confusion_tbl["is_labelled_laundering"] == True]
    top6 = list(tp_sub.sort_values("recall", ascending=False).head(6)["typology"])
    if "Smurfing" not in top6:
        top6.append("Smurfing")

    cut_top1 = np.percentile(df["anomaly_score_normalized"], 99.0)
    print(f"  top 1% cutoff on anomaly_score_normalized = {cut_top1:.6f}", flush=True)

    rows = []
    for typ in top6:
        pos = df[(df["Laundering_type"] == typ) & (df["Is_laundering"] == 1)]
        if len(pos) == 0:
            continue
        scores = pos["anomaly_score_normalized"].values
        rows.append(
            {
                "typology": typ,
                "n_positives": int(len(pos)),
                "flagged_rate": float(pos["is_anomalous"].mean()),
                "mean": float(scores.mean()),
                "p10": float(np.quantile(scores, 0.10)),
                "p50": float(np.quantile(scores, 0.50)),
                "p90": float(np.quantile(scores, 0.90)),
                "p99": float(np.quantile(scores, 0.99)),
                "pct_within_20pct_of_cutoff": float(
                    np.mean((scores < cut_top1) & (scores >= 0.8 * cut_top1))
                ),
            }
        )
    tbl = pd.DataFrame(rows)
    print(tbl.round(4).to_string(index=False), flush=True)
    tbl.to_csv(RESULTS_DIR / "06_score_distribution_by_typology.csv", index=False)
    return tbl


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------
def main() -> None:
    t0 = time.time()
    print(f"Reading: {PARQUET_PATH}")
    df = load_scored()
    df = attach_labels(df)

    # 1. Permutation importance
    imp = permutation_importance_if(df)

    # 2. Typology confusion at top 1%
    typ_tbl = typology_confusion(df)

    # 3. Correlation + disagreement
    agreement = score_agreement(df)

    # 4. False-positive profiling
    fp = fp_profile(df)

    # 5. Threshold sensitivity for primary typologies
    thr = threshold_sensitivity(df)

    # 6. Score distribution by typology (labelled positives)
    dist = score_dist_by_typology(df, typ_tbl)

    # Persist a compact JSON with the headline numbers for the markdown step
    headline = {
        "rows": int(len(df)),
        "positives": int(df["Is_laundering"].sum()),
        "flag_rate": float(df["is_anomalous"].mean()),
        "overall_precision": float(
            df.loc[df["is_anomalous"] == 1, "Is_laundering"].mean()
        ),
        "overall_recall": float(
            df.loc[df["Is_laundering"] == 1, "is_anomalous"].mean()
        ),
        "top_importances": imp.head(10).to_dict(orient="records"),
        "agreement": agreement,
        "runtime_seconds": time.time() - t0,
    }
    with open(RESULTS_DIR / "00_headline.json", "w") as f:
        json.dump(headline, f, indent=2, default=float)
    print(f"\nALL DONE in {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    main()
