import pandas as pd
from mlxtend.frequent_patterns import fpgrowth
from mlxtend.preprocessing import TransactionEncoder


ATTRIBUTES = [
    "Payment_type",
    "Sender_bank_location",
    "Receiver_bank_location",
    "Payment_currency",
    "Received_currency",
    "is_currency_conversion_str",
    "any_high_risk_str",
    "is_weekend_str",
]

# Convert numeric values to categorical attributes for pattern mining
def prepare_attributes(df: pd.DataFrame) -> pd.DataFrame:
    for str_col, flag_col in [
        ("is_currency_conversion_str", "is_currency_conversion"),
        ("any_high_risk_str", "any_high_risk"),
        ("is_weekend_str", "is_weekend"),
    ]:
        df[str_col] = df[flag_col].map({1: "yes", 0: "no"}).astype("category")
    return df

# for a predicate
# support = count_in_outliers / total_outliers
# pop_rate = count_in_population / total_population
# risk_ratio = support / pop_rate

# Ranks individuals attributes by risk ratio (how overrepresented they are in anomalies vs normal)
def compute_single_attribute_risk_ratios(
    outliers: pd.DataFrame,
    full_population: pd.DataFrame,
    attribute_cols: list = ATTRIBUTES,
    min_support: float = 0.001,
    min_risk_ratio: float = 3.0,
) -> pd.DataFrame:

    total_outliers = len(outliers)
    total_population = len(full_population)
    records = []

    # loop through each attribute column
    for col in attribute_cols:
        outlier_counts = outliers[col].value_counts()
        population_counts = full_population[col].value_counts()

        # loop through each value in that column
        for value, outlier_count in outlier_counts.items():
            support = outlier_count / total_outliers
            if support < min_support:
                continue

            pop_count = population_counts.get(value, 0)
            pop_rate = pop_count / total_population if total_population > 0 else 0

            risk_ratio = float("inf") if pop_rate == 0 else support / pop_rate
            if risk_ratio < min_risk_ratio:
                continue

            # store qualifying single-attribute predicate
            records.append({
                "attribute": col,
                "value": str(value),
                "predicate": f"{col}={value}",
                "outlier_count": outlier_count,
                "population_count": pop_count,
                "support": support,
                "pop_rate": pop_rate,
                "risk_ratio": risk_ratio,
            })

    result = pd.DataFrame(records)

    # rank strongest predicates first
    if not result.empty:
        result = result.sort_values("risk_ratio", ascending=False).reset_index(drop=True)

    return result


# build frequent multi-attribute patterns from outliers
# then compare how common each pattern is in outliers vs full population

# Uses FP-Growth Algorithm to find frequent multi-attribute patterns in anomalies
def compute_combination_risk_ratios(
    outliers: pd.DataFrame,
    full_population: pd.DataFrame,
    candidate_predicates: pd.DataFrame,
    attribute_cols: list = ATTRIBUTES,
    min_support: float = 0.001,
    min_risk_ratio: float = 3.0,
    max_combination_size: int = 3,
) -> pd.DataFrame:
    if candidate_predicates.empty:
        return pd.DataFrame()

    # only allow predicates that survived the single-attribute stage
    valid_predicates = set(candidate_predicates["predicate"].tolist())

    # convert one row into a list of valid predicate strings
    def encode_row(row):
        return [
            f"{col}={row[col]}"
            for col in attribute_cols
            if f"{col}={row[col]}" in valid_predicates
        ]

    print("Encoding outlier transactions for FP-Growth:")

    # each outlier becomes a transaction of predicates
    outlier_transactions = [t for t in outliers.apply(encode_row, axis=1) if t]

    if not outlier_transactions:
        return pd.DataFrame()

    # one-hot encode transactions for FP-Growth
    te = TransactionEncoder()
    te_array = te.fit_transform(outlier_transactions)
    df_encoded = pd.DataFrame(te_array, columns=te.columns_)

    print(
        f"Running FP-Growth on {len(df_encoded):,} outlier transactions, "
        f"{len(te.columns_)} candidate predicates"
    )

    # find frequent predicate combinations in outliers
    frequent_itemsets = fpgrowth(
        df_encoded,
        min_support=min_support,
        use_colnames=True,
        max_len=max_combination_size,
    )

    if frequent_itemsets.empty:
        print("No frequent itemsets found. Try lowering min_support.")
        return pd.DataFrame()

    print(f"Found {len(frequent_itemsets)} frequent itemsets.")

    total_outliers = len(outliers)
    total_population = len(full_population)
    records = []

    # evaluate each frequent combination
    for _, row in frequent_itemsets.iterrows():
        itemset = list(row["itemsets"])

        # skip single predicates because they were already handled above
        if len(itemset) < 2:
            continue

        # find how many full-population rows satisfy all predicates in the itemset
        mask = pd.Series(True, index=full_population.index)
        for predicate in itemset:
            col, val = predicate.split("=", 1)
            mask &= full_population[col].astype(str) == val

        pop_count = mask.sum()
        outlier_support = row["support"]
        outlier_count = int(outlier_support * total_outliers)
        pop_rate = pop_count / total_population if total_population > 0 else 0
        risk_ratio = float("inf") if pop_rate == 0 else outlier_support / pop_rate

        if risk_ratio < min_risk_ratio:
            continue

        # store qualifying multi-attribute predicate combination
        records.append({
            "predicates": " ∧ ".join(sorted(itemset)),
            "n_attributes": len(itemset),
            "outlier_count": outlier_count,
            "population_count": pop_count,
            "outlier_support": outlier_support,
            "pop_rate": pop_rate,
            "risk_ratio": risk_ratio,
        })

    result = pd.DataFrame(records)

    # rank strongest combinations first
    if not result.empty:
        result = result.sort_values("risk_ratio", ascending=False).reset_index(drop=True)

    return result


# combine single-attribute and multi-attribute explanations
# then rank them into one alert table
def format_alerts(
    single_attr_results: pd.DataFrame,
    combo_results: pd.DataFrame,
    top_n: int = 50,
) -> pd.DataFrame:
    # rename columns so single-attribute results match combo format
    single_formatted = single_attr_results.rename(columns={
        "predicate": "predicates",
        "support": "outlier_support",
    })[["predicates", "outlier_count", "outlier_support", "pop_rate", "risk_ratio"]].copy()

    # mark these as 1-attribute alerts
    single_formatted["n_attributes"] = 1

    # keep combo results in the same output schema
    combo_cols = ["predicates", "n_attributes", "outlier_count", "outlier_support", "pop_rate", "risk_ratio"]
    combo_formatted = combo_results[combo_cols].copy() if not combo_results.empty else pd.DataFrame(columns=combo_cols)

    # merge both result sets and rank by risk ratio
    alerts = (
        pd.concat([single_formatted, combo_formatted], ignore_index=True)
        .sort_values("risk_ratio", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )

    # make the output look like a ranked leaderboard
    alerts.index += 1
    alerts.index.name = "rank"

    return alerts


# full explanation pipeline
# 1. prepare attributes
# 2. split outliers vs full population
# 3. find single-attribute explanations
# 4. find combination explanations
# 5. format final alerts
def run_explanation(
    df: pd.DataFrame,
    attribute_cols: list = ATTRIBUTES,
    min_support: float = 0.001,
    min_risk_ratio: float = 3.0,
    max_combination_size: int = 3,
    top_n: int = 50,
) -> pd.DataFrame:
    df = prepare_attributes(df)

    # outliers are the rows already flagged by the anomaly stage
    outliers = df[df["is_anomalous"] == 1]
    full_population = df

    print(f"Explanation stage: {len(outliers):,} outliers vs {len(full_population):,} total")

    # find suspicious single predicates
    single = compute_single_attribute_risk_ratios(
        outliers, full_population, attribute_cols, min_support, min_risk_ratio
    )
    print(f"Single-attribute candidates: {len(single)}")

    # find suspicious combinations of the single-predicate candidates
    combos = compute_combination_risk_ratios(
        outliers, full_population, single, attribute_cols,
        min_support, min_risk_ratio, max_combination_size
    )
    # merge all results into one ranked alert table
    alerts = format_alerts(single, combos, top_n)
    return alerts