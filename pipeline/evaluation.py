import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score


def compare_scorers(
    df: pd.DataFrame,
    label_col: str = "Is_laundering",
    threshold_pct: float = 1.0,
) -> pd.DataFrame:
    """
    Side-by-side comparison of Isolation Forest, MAD, and MCD at a fixed
    percentile threshold. Requires ground-truth labels.

    For each scorer, reports: flagged count, true positives, precision,
    recall, F1, and ROC-AUC over the full score distribution.
    """
    score_cols = {
        "Isolation Forest": "anomaly_score",
        "MAD":              "anomaly_score_mad",
        "MCD":              "anomaly_score_mcd",
    }

    total_suspicious = df[label_col].sum()
    rows = []

    print("\n" + "=" * 70)
    print(f"SCORER COMPARISON  (threshold = top {threshold_pct}%)")
    print("=" * 70)
    print(
        f"{'Scorer':<20} {'Flagged':>10} {'TP':>8} "
        f"{'Precision':>10} {'Recall':>10} {'F1':>8} {'ROC-AUC':>9}"
    )
    print("-" * 70)

    for name, col in score_cols.items():
        if col not in df.columns:
            print(f"{name:<20}  (score column '{col}' not found — skipped)")
            continue

        cutoff = np.percentile(df[col], 100 - threshold_pct)
        flagged = df[df[col] >= cutoff]
        n_flagged = len(flagged)
        n_tp = flagged[label_col].sum()

        precision = n_tp / n_flagged if n_flagged > 0 else 0
        recall = n_tp / total_suspicious if total_suspicious > 0 else 0
        f1 = 2 * precision * recall / (precision + recall + 1e-10)
        roc_auc = roc_auc_score(df[label_col].values, df[col].values)

        print(
            f"{name:<20} {n_flagged:>10,} {n_tp:>8,} "
            f"{precision * 100:>9.2f}% {recall * 100:>9.2f}% "
            f"{f1:>8.4f} {roc_auc:>9.4f}"
        )

        rows.append({
            "scorer": name,
            "score_col": col,
            "n_flagged": n_flagged,
            "n_true_positives": n_tp,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "roc_auc": roc_auc,
        })

    print("=" * 70)
    return pd.DataFrame(rows)


def evaluate_pipeline(
    df: pd.DataFrame,
    alerts: pd.DataFrame,
    threshold_results: list,
    label_col: str = "Is_laundering",
    laundering_type_col: str = "Laundering_type",
) -> None:

    # Basic dataset statistics
    total = len(df)
    total_suspicious = df[label_col].sum()

    print("\n" + "=" * 60)
    print("Pipeline Eval Report")
    print("=" * 60)

    print(
        f"\nDataset Summary\n"
        f"  Total transactions : {total:,}\n"
        f"  Labeled suspicious : {total_suspicious:,} "
        f"({total_suspicious / total * 100:.3f}%)"
    )

    # 1. Precision / Recall trade-off across anomaly thresholds
    print("\n" + "-" * 60)
    print("1. Precision–Recall Trade-off by Threshold")
    print("-" * 60)

    print(
        f"{'Threshold':>12} {'Flagged':>12} {'True Pos':>10} "
        f"{'Precision':>10} {'Recall':>10} {'F1':>10}"
    )

    for r in threshold_results:
        print(
            f"{r['pct_flagged']:>11.1f}% "
            f"{r['n_flagged']:>12,} "
            f"{r['n_true_positives']:>10,} "
            f"{r['precision'] * 100:>9.2f}% "
            f"{r['recall'] * 100:>9.2f}% "
            f"{r['f1']:>10.4f}"
        )

    # 2. Top suspicious patterns discovered by the explanation stage
    # These patterns are ranked by risk ratio (how overrepresented
    # they are among anomalous transactions vs the full population).
    print("\n" + "-" * 60)
    print("2. Top Detected Risk Patterns")
    print("-" * 60)

    print("Top 20 alerts ranked by risk ratio:\n")

    print(
        alerts[["predicates", "outlier_support", "risk_ratio", "outlier_count"]]
        .head(20)
        .to_string()
    )

    # 3. Distribution of laundering typologies in flagged transactions
    # Helps determine what types of laundering behavior the
    # anomaly detector is capturing.
    print("\n" + "-" * 60)
    print("3. Laundering Types in Flagged Transactions")
    print("-" * 60)

    anomalous = df[df["is_anomalous"] == 1]

    print(
        anomalous[laundering_type_col]
        .value_counts()
        .head(20)
        .to_string()
    )

    # 4. Recovery rate for each laundering typology
    # Measures how well the pipeline detects different types
    # of laundering activity.
    print("\n" + "-" * 60)
    print("4. Detection Rate by Laundering Typology")
    print("-" * 60)

    for typology in df[laundering_type_col].dropna().unique():

        if "Normal" in str(typology):
            continue

        total_of_type = (df[laundering_type_col] == typology).sum()
        recovered = (
            (df[laundering_type_col] == typology)
            & (df["is_anomalous"] == 1)
        ).sum()

        if total_of_type > 0:
            rate = recovered / total_of_type * 100

            print(
                f"{typology:<30} "
                f"{recovered:>8,} / {total_of_type:<8,} "
                f"({rate:5.1f}% detected)"
            )