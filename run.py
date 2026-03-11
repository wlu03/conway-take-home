import sys
import time
import pandas as pd

from pipeline.ingestion import load_data
from pipeline.features import build_features
from pipeline.score import score_transactions, score_mad, score_mcd, save_models, METRIC_FEATURES
from pipeline.classification import classify_transactions, analyze_threshold
from pipeline.explanation import (
    ATTRIBUTES,
    prepare_attributes,
    compute_single_attribute_risk_ratios,
    compute_combination_risk_ratios,
    format_alerts,
)
from pipeline.evaluation import evaluate_pipeline, compare_scorers


def run(data_path: str, evaluate: bool = True, save_model_path: str = "models/"):
    t0 = time.time()

    print("\n[Stage 0] Loading data and building features")
    df = load_data(data_path)

    labels = df[["Is_laundering", "Laundering_type"]].copy()
    df = df.drop(columns=["Is_laundering", "Laundering_type"])

    df = build_features(df)
    df = prepare_attributes(df)

    print(f"Features ready with rows: {len(df)} | cols: {df.shape[1]} | time: {time.time() - t0:.1f}s")

    t1 = time.time()
    print("\n[Stage 1] Scoring")

    print("  [1a] Isolation Forest...")
    df, clf, scaler = score_transactions(df, features=METRIC_FEATURES)
    print(f"  Isolation Forest done in time: {time.time() - t1:.1f}s")

    t1b = time.time()
    print("  [1b] MAD (Median Absolute Deviation)...")
    df, mad_params = score_mad(df, features=METRIC_FEATURES)
    print(f"  MAD done | time: {time.time() - t1b:.1f}s")

    t1c = time.time()
    print("  [1c] MCD (Minimum Covariance Determinant)")
    df, mcd = score_mcd(df, features=METRIC_FEATURES)
    print(f"  MCD done using time: {time.time() - t1c:.1f}s")

    print(f"All scorers complete using total scoring time: {time.time() - t1:.1f}s")

    # Isolation Forest is the primary scorer — classify on its scores
    t2 = time.time()
    print("\n[Stage 2] Classification (using Isolation Forest scores)")
    df, cutoff = classify_transactions(df, score_col="anomaly_score", threshold_pct=1.0)
    print(f"Classification complete using time: {time.time() - t2:.1f}s")

    # Save all trained models for later inference on new data
    save_models(save_model_path, clf, scaler, mcd, mad_params, cutoff, METRIC_FEATURES)
    print(f"Models saved to {save_model_path}")

    t3 = time.time()
    print("\n[Stage 3] Generating explanations")

    outliers = df[df["is_anomalous"] == 1]
    print(f"Outliers detected: {len(outliers)}")

    single_attr = compute_single_attribute_risk_ratios(
        outliers, df, ATTRIBUTES, min_support=0.001, min_risk_ratio=3.0
    )
    print(f"Single predicates: {len(single_attr)}")

    combos = compute_combination_risk_ratios(
        outliers, df, single_attr, ATTRIBUTES,
        min_support=0.001, min_risk_ratio=3.0
    )
    print(f"Predicate combinations: {len(combos)}")

    alerts = format_alerts(single_attr, combos, top_n=50)

    print("\nTop alerts:")
    print(alerts[["predicates", "outlier_support", "risk_ratio"]].head(10).to_string())

    print(f"Explanation stage time: {time.time() - t3:.1f}s")

    if evaluate:
        print("\n[Stage 4] Evaluating results")
        df["Is_laundering"] = labels["Is_laundering"].values
        df["Laundering_type"] = labels["Laundering_type"].values

        # Compare all three scorers side by side
        compare_scorers(df, threshold_pct=1.0)

        # Full evaluation report using the primary (Isolation Forest) scorer
        threshold_results = analyze_threshold(df, score_col="anomaly_score")
        evaluate_pipeline(df, alerts, threshold_results)

    print(f"\nPipeline finished with total time: {time.time() - t0:.1f}s")

    return df, alerts


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "data/SAML-D.csv"
    run(path)