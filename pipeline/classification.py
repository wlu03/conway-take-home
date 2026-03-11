import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

# Eval using ground truth labels
# return different statistics at multiple thresholds
def analyze_threshold(
    df: pd.DataFrame,
    score_col: str = "anomaly_score",
    label_col: str = "Is_laundering",
    thresholds: list = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
) -> list[dict]:

    total_suspicious = df[label_col].sum() # count true suspicious transactions
    results = []

    # loop over different thresholds
    for pct in thresholds:
        cutoff = np.percentile(df[score_col], 100 - pct)
        # all transactions whose score is above the cutoff given the thresholds are flagged
        flagged = df[df[score_col] >= cutoff]
        n_flagged = len(flagged)
        n_true_pos = flagged[label_col].sum()

        if n_flagged > 0:
            precision = n_true_pos / n_flagged
        else:
            precision = 0

        if total_suspicious > 0:
            recall = n_true_pos / total_suspicious
        else:
            recall = 0
        f1 = 2 * precision * recall / (precision + recall + 1e-10)

        results.append({
            "pct_flagged": pct,
            "n_flagged": n_flagged,
            "n_true_positives": n_true_pos,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "threshold": cutoff,
        })

        print(f"Top {pct}% flagged: {n_flagged:,} transactions")
        print(f"  True positives: {n_true_pos:,} / {total_suspicious:,} ({recall*100:.1f}% recall)")
        print(f"  Precision: {precision*100:.2f}%")
        print(f"  F1: {f1:.4f}")
        print()

    roc_auc = roc_auc_score(df[label_col].values, df[score_col].values)
    print(f"ROC-AUC: {roc_auc:.4f}")

    return results


# Classificaiton function that converts anomaly scores into binary labels
# instead of testing multiple thresholds this function uses one threshold and labels transactions as 
# (1,0) = (flagged/normal)
# Used after selecting the best threshold from evaluations
def classify_transactions(
    df: pd.DataFrame,
    score_col: str = "anomaly_score",
    threshold_pct: float = 1.0,
) -> tuple[pd.DataFrame, float]:
    cutoff = np.percentile(df[score_col], 100 - threshold_pct)
    df["is_anomalous"] = (df[score_col] >= cutoff).astype("int8")

    n_anomalous = df["is_anomalous"].sum()
    print(
        f"Classification at top {threshold_pct}%: "
        f"{n_anomalous:,} flagged as anomalous "
        f"({n_anomalous / len(df) * 100:.3f}% of total)"
    )

    return df, cutoff
