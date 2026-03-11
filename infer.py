"""
Inference script helps to score a new CSV using pre-trained models.

Usage:
    python infer.py data/new_transactions.csv
    python infer.py data/new_transactions.csv --models models/ --output results/scored.csv

Constraints: 
- The new CSV must have the same raw columns as the training data

Additional:
- Ground-truth columns (Is_laundering, Laundering_type) are not required. Pruned if attached
"""
import argparse
import sys
import time
import pandas as pd

from pipeline.ingestion import load_data
from pipeline.features import build_features
from pipeline.explanation import prepare_attributes, run_explanation, ATTRIBUTES
from pipeline.score import load_models, apply_scores


def infer(
    data_path: str,
    model_path: str = "models/",
    output_path: str = None,
    include_graph: bool = True,
    explain: bool = True,
):
    t0 = time.time()
    print(f"\n[Step 1] Loading {data_path}...")
    df = load_data(data_path)
    df = df.drop(columns=["Is_laundering", "Laundering_type"], errors="ignore")

    print("[Step 2] Building features")
    df = build_features(df, include_graph=include_graph)
    df = prepare_attributes(df)
    print(f"Features ready with rows: {len(df):,} | cols: {df.shape[1]}")

    # Load trained models
    print(f"\n[Step 3] Loading models from {model_path}...")
    models = load_models(model_path)
    print(
        f"Loaded with features: {len(models['features'])} | "
        f"cutoff: {models['cutoff']:.4f}"
    )

    # Apply scores and classify using the stored cutoff
    print("\n[Step 4] Scoring")
    df = apply_scores(
        df,
        clf=models["clf"],
        scaler=models["scaler"],
        mcd=models["mcd"],
        mad_params=models["mad_params"],
        features=models["features"],
        cutoff=models["cutoff"],
    )
    if explain:
        print("\n[Step 5] Generating explanations")
        outliers = df[df["is_anomalous"] == 1]
        if len(outliers) == 0:
            print("No anomalous transactions flagged: skipping explanation.")
            alerts = pd.DataFrame()
        else:
            alerts = run_explanation(
                df,
                min_support=0.001,
                min_risk_ratio=3.0,
                max_combination_size=3,
                top_n=50,
            )
            print("\nTop 10 alerts:")
            print(alerts[["predicates", "outlier_support", "risk_ratio"]].head(10).to_string())
    else:
        alerts = pd.DataFrame()

    if output_path:
        df.to_csv(output_path, index=False)
        print(f"\nScored output saved to {output_path}")

    print(f"\nInference complete using a total time: {time.time() - t0:.1f}s")
    return df, alerts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score a new transaction CSV using pre-trained models.")
    parser.add_argument("data_path", help="Path to the new CSV file")
    parser.add_argument("--models",  default="models/",  help="Directory containing saved models (default: models/)")
    parser.add_argument("--output",  default=None,        help="Path to save scored output CSV (optional)")
    parser.add_argument("--no-graph",   action="store_true", help="Skip graph feature computation (faster)")
    parser.add_argument("--no-explain", action="store_true", help="Skip explanation stage")
    args = parser.parse_args()

    infer(
        data_path=args.data_path,
        model_path=args.models,
        output_path=args.output,
        include_graph=not args.no_graph,
        explain=not args.no_explain,
    )
