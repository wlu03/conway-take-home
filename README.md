# MacroBase AML Pipeline
This is a pipeline that uses a MacroBase-style anomaly detection and explanation pipeline over the [SAML-D](https://ieeexplore.ieee.org/document/10356193) synthetic anti-money laundering dataset. Pipeline is fully unsupervised at training time and ground-truth labels are used only at evaluation.

---

## Initial Run

```bash
pip install -r requirements.txt
python run.py data/SAML-D.csv
```

## Inference on New Data

Train once on the full dataset by running the script in **initial run**. models are saved automatically to `models/`. Run inference on any new CSV without retraining:

```bash
python infer.py data/new_transactions.csv
python infer.py data/new_transactions.csv --output results/scored.csv
python infer.py data/new_transactions.csv --no-graph # skip graph features
python infer.py data/new_transactions.csv --no-explain # skip FP-Growth
```
New CSV must be in the same format as the training data. Ground-truth coluimns are not required for inference. 

**`models/`:**

| File | Contents |
|---|---|
| `isolation_forest.joblib` | Fitted `IsolationForest` |
| `scaler.joblib` | Fitted `StandardScaler` |
| `mcd.joblib` | Fitted `MinCovDet` |
| `mad_params.joblib` | `medians` + `mads` arrays from training data |
| `meta.joblib` | `cutoff` (classification threshold) + feature list |

`apply_scores()` uses the training data's `medians`/`mads` for MAD scoring and the stored `cutoff` for classification. The new CSV never influences the model, so scoring is fully consistent with training.

---
## Architecture

The pipeline follows the MacroBase architecture where you: 

```
1. Ingest Data and Build Features (transaction, account, graph)
2. Score Transactions, Isolation Forest (primary), MAD, MCD
3. Classify Anomalies using a Percentile Threshold
4. Generate Explanations with Risk Ratios and FP-Growth
5. Evaluate with Ground Truth Labels
```

---

## Feature Engineering

### Transaction-level features (row-by-row)

| Feature | Signal |
|---|---|
| `log_amount` | Compresses amount distribution so subtle anomalies aren't drowned out by large transactions |
| `is_currency_conversion` | `Payment_currency != Received_currency`|
| `sender_blacklist` / `sender_greylist` | Money sent to sus countries, formally: FATF black and grey list |
| `receiver_blacklist` / `receiver_greylist` | Same, on the receiving side |
| `any_high_risk` | Either counterparty in a FATF-listed jurisdiction |
| `just_below_Xk` / `below_Xk_margin` | Structuring signals at SAR/IRS reporting thresholds (2k, 5k, 10k, 50k) |
| `is_off_hours` / `is_weekend` | Time anomaly |

### Account-level behavioural features (groupby + merge)

| Feature | AML Pattern Targeted |
|---|---|
| `sender_fan_out_ratio` | Fan-Out: one sender distributing to many receivers |
| `sender_amount_cv` | Structuring: low CV means many suspiciously similar-sized transactions |
| `sender_unique_receiver_countries` | Layering: money touching many jurisdictions |
| `receiver_fan_in_ratio` | Fan-In: many senders funnelling to one aggregator |
| `time_since_last_tx_hours` | Rapid succession structuring |

### Graph-level features (pipeline/graph_features.py)

Transaction-level and account-level features score each row independently. They cannot see patterns that only exist across multiple related accounts. Weber et al. (2019) show that graph-based features are critical for detecting typologies like Cycle, Scatter-Gather, and Bipartite layering patterns where the signal could be in the network topology, not in any individual transaction.

`graph_features.py` builds a compact directed edge table (one row per unique sender→receiver pair) and computes per-account graph statistics using pandas merge operations. 

no full graph traversal, so it scales to 9.5M rows.

| Feature | AML Pattern Targeted | How it's computed |
|---|---|---|
| `in_2hop_cycle` | Cycle / round-tripping (A→B→A) | Self-join edge table on Receiver=Sender, check terminal = origin |
| `in_3hop_cycle` | Cycle through one shell account (A→B→C→A) | Two-hop join extended by one more hop |
| `in_any_cycle` | Union of above | OR of 2-hop and 3-hop flags |
| `min_cycle_len` | Shortest cycle involving this account | 2, 3, or 0 if no cycle |
| `scatter_source_count` | Scatter-Gather intermediary detection | Count of high-fan-out senders that send TO this account |
| `gather_target_count` | Scatter-Gather convergence detection | Count of co-receivers that share senders and downstream targets |
| `scatter_gather_score` | Combined scatter-gather signal | Product of normalised scatter_source_count × gather_target_count |
| `shared_counterparty_count` | Round-tripping / coordinated layering | Count of accounts that both send to AND receive from this account |

**Why graph features?:**

Weber et al. (2019) demonstrate on the Elliptic Bitcoin dataset that graph neural network features improve AML detection F1 by 30–40% over transaction-level features alone, specifically on layering typologies where individual transactions appear normal. Savage et al. (2016) show that money laundering networks have measurably different topological properties (higher clustering coefficient, shorter average path length, more bidirectional edges) than legitimate transaction graphs. The SAML-D paper (Oztas et al., 2023) explicitly labels Cycle, Scatter-Gather, Stacked Bipartite, and Layered Fan-In/Out as typologies that require network-level analysis to detect.

The graph features implemented here are a pandas-based approximation of full GNN approaches. They capture the most structural signals (cycle membership, scatter-gather role, bidirectional ties) without requiring a graph library or high computing power. 

---

## Stage 1: Scoring

Three scoring methods are run in parallel. All write to separate score columns so results can be compared directly.

### Isolation Forest

The paper's MAD/MCD approach assumes inliers follow a Gaussian. SAML-D inliers are multimodal: cash deposits, cheques, cross-border wires, and payroll runs each have different amount distributions and timing patterns. A single Gaussian cannot fit this.

Isolation Forest is non-parametric so it splits features at random and measures how few splits are needed to isolate a point. Anomalies are isolated quickly because they sit in sparse regions of feature space. This handles multimodal inliers naturally.

**Key parameters:**
- `n_estimators=100`: diminishing returns beyond this (per Liu et al. 2008)
- `max_samples=256`: paper's recommendation; small subsamples reduce masking effects when anomalies cluster
- `contamination=0.01`: set at 1% (10× the true ~0.1% rate) to give the score distribution more dynamic range. the actual classification threshold is tuned separately in Stage 2

Output columns: `anomaly_score`, `anomaly_score_normalized`

### Median Absolute Deviation

For each feature independently:
```
MAD = median(|x - median(x)|)
modified_z = 0.6745 * |x - median| / MAD
```
The `0.6745` constant makes MAD consistent with standard deviation under Gaussian assumptions. The final `anomaly_score_mad` is the **maximum** modified Z-score across all features — a transaction is anomalous if it is an outlier in any single feature dimension.

**Limitation:** Univariate where it cannot detect anomalies that only emerge when multiple features are considered together.

Output columns: `anomaly_score_mad`, `anomaly_score_mad_normalized`

### Minimum Covariance Determinant

Fits a robust covariance ellipsoid to the tightest cluster of inlier points (controlled by `support_fraction=0.95`), then scores all transactions by their **Mahalanobis distance** from the robust centroid. Unlike MAD, MCD accounts for feature correlations.

FastMCD is O(n·p²) so the model is fitted on a 10k subsample and used to score the full dataset.

**Limitation:** Assumes a single ellipsoidal inlier cluster (roughly multivariate Gaussian). SAML-D's multimodal inlier population violates this assumption, which is why Isolation Forest remains the primary scorer.

Output columns: `anomaly_score_mcd`, `anomaly_score_mcd_normalized`

### Scorer comparison

`compare_scorers()` in `pipeline/evaluation.py` prints a side-by-side table of precision, recall, F1, and ROC-AUC for all three scorers at the same percentile cutoff.

---

## Stage 2: Classification: Precision/Recall Trade-off

At 0.1% true prevalence in 9.5M rows there are ~9,500 true suspicious transactions. Threshold choice affects both recall and downstream explanation quality:

| Threshold | Flagged | Approx. Precision | Approx. Recall | Explanation quality |
|---|---|---|---|---|
| Top 0.1% | ~9,500 | High | Low | Clean signal, only obvious patterns |
| **Top 1.0%** | **~95,000** | **~10–15%** | **High** | **Good signal, manageable noise** |
| Top 5.0% | ~475,000 | ~2–3% | Very high | Noise dominates, risk ratios shrink |

**Default: top 1%.** Setting the threshold too permissively dilutes the anomalous population passed to the explanation stage, risk ratios shrink and alerts become uninformative. Too strict, and only the most "obvious" patterns survive then subtle typologies are missed.

---

## Stage 3: Explanation: Risk Ratio + FP-Growth

Implements Algorithm 2 from Bailis et al. For each attribute combination:

```
risk_ratio = (count_in_outliers / total_outliers) / (count_in_population / total_population)
```

A risk ratio of 40 means this attribute combination is 40× more common in flagged transactions than in the full dataset.

**Two-pass strategy (from the paper):**
1. Compute single-attribute risk ratios over the small outlier set (~95,000 rows). Prune anything below `min_support=0.001` or `min_risk_ratio=3.0`.
2. Run FP-Growth over outliers using only the surviving candidate predicates. Compute risk ratios for each frequent itemset against the full population.

This is efficient because FP-Growth runs on the outlier set (1% of data), not the full 9.5M rows.

**Attribute columns used for explanation:**
```
Payment_type, Sender_bank_location, Receiver_bank_location,
Payment_currency, Received_currency,
is_currency_conversion_str, any_high_risk_str, is_weekend_str
```

---

## Stage 4: Evaluation

Ground-truth labels (`Is_laundering`, `Laundering_type`) are dropped before any processing and reattached only in the evaluation stage. Reported metrics:

- **Scorer comparison**:  Isolation Forest vs MAD vs MCD at top 1% (precision, recall, F1, ROC-AUC)
- **Precision/recall table** at 0.1%, 0.5%, 1.0%, 2.0%, 5.0%, 10.0% thresholds
- **ROC-AUC** over the full score distribution
- **Recovery rate per typology**: which AML patterns the pipeline successfully flags
- **Explanation alignment**: qualitative annotation of whether top-ranked alerts correspond to known typologies

---

## Limitation with Current Pipeline Design

**Temporal structuring across days:** `time_since_last_tx_hours` captures rapid succession but misses coordinated transactions spread over days. A rolling window count would be more precise but is expensive at 9.5M rows.

**Overlapping Classes:** SAML-D includes typologies `Normal_Fan_Out` and `Suspicious_Fan_Out` which are structurally similar. Unsupervised detection will produce false positives in these cases of overlap. 

**Scalability Issues with Graph:** 
Transaction level isolation forest scores each transaction independently and will miss graph level patterns. This is the main reason why I added graph features to capture other network typologies to detect pattern across multiple transaction by related account. However, the main issue with this is scalability. The current runtime complexity is $O(E^2)$ in unique edges. On a dataset with millions of unique (sender, receiver) pairs this can be slow. Thus, `build_features()` has a way to exclude the graph features if runtime is a major constraint. 

**MCD multimodality assumption:** MCD assumes inliers form a single Gaussian cluster. SAML-D inliers are multimodal, so MCD will misfit. This is why isolation forest was implemented 



---

## Note for scaling

Because feature eng. is the runtime bottleneck. Save features to parquet after a first run. 

```python
df.to_parquet("data/features.parquet", index=False)
df = pd.read_parquet("data/features.parquet")  # subsequent runs
```
---

## References

1. Bailis et al., [MacroBase: Prioritizing Attention in Fast Data](https://cs.stanford.edu/people/chrismre/papers/macrobase.pdf), SIGMOD 2017 — pipeline architecture, risk ratio formula, Algorithm 2
2. Oztas et al., [Enhancing Anti-Money Laundering: Development of a Synthetic Transaction Monitoring Dataset](https://ieeexplore.ieee.org/document/10356193), IEEE 2023 — dataset structure and typology definitions
3. Liu et al., [Isolation Forest](https://ieeexplore.ieee.org/document/4781136), ICDM 2008 — scoring method, `max_samples=256` justification
4. Han et al., [Mining Frequent Patterns without Candidate Generation](https://dl.acm.org/doi/10.1145/335191.335372), SIGMOD 2000 — FP-Growth algorithm used in explanation stage
5. Weber et al., [Anti-Money Laundering in Bitcoin: Experimenting with Graph Convolutional Networks for Financial Forensics](https://arxiv.org/abs/1908.02591), KDD Workshop 2019 — empirical evidence that graph features improve AML detection F1 by 30–40% over transaction-level features on layering typologies
6. Savage et al., [Detection of Money Laundering Groups Using Supervised Learning in Networks](https://arxiv.org/abs/1608.00708), 2016 — shows laundering networks have measurably different topological properties (clustering coefficient, path length, bidirectional edges) than legitimate transaction graphs
7. FATF, [Countries under Increased Monitoring](https://www.fatf-gafi.org/en/topics/high-risk-and-other-monitored-jurisdictions.html), February 2026 — source for grey/blacklist country sets
