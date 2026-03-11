import pandas as pd


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