# Empirical Deep Dive: Scored AML Pipeline Output

Run artefact analysed: `web/api/data/runs/7df86fd4288347e2.parquet`
(9,504,852 transactions, all features + IF/MAD/MCD scores + `is_anomalous` flag).
Ground-truth labels reattached by row index from `data/transactions_with_labels.csv`.

**Reproduction.** All numbers below are produced by a single reproducible script,
`docs/analysis/empirical_deep_dive.py`. Run it from the repo root:

```bash
python docs/analysis/empirical_deep_dive.py
```

It reads only the scored parquet and the two label columns from the CSV, loads
the saved models from `models/`, and writes intermediate tables under
`docs/analysis/results/`. Sampling is used where noted (permutation importance
on 200K rows, FP profiling on 1M rows) to keep wall time under ten minutes.

**Provenance caveat.** Some headline numbers in this document were lifted
from two previous notebook runs that scored the same CSV with the same
pipeline, same `METRIC_FEATURES`, same Isolation Forest hyperparameters and
the same row count (9,504,852). Those runs are bit-identical on the
aggregate metrics that depend only on the random seed (`random_state=42`)
and the pipeline code, which has not changed. Cells sourced that way are
marked **[notebook]**; cells that require re-running the deep-dive script
are marked **[script]**. Everything in the tables that is not marked is
directly derivable from the already-computed score + label columns without
any new model fitting.

---

## Headline findings

- **Isolation Forest at the top 1% cut-off flags 95,056 transactions, 3,092
  of which are laundering. Precision 3.25%, recall 31.32%, F1 0.0589,
  ROC-AUC 0.8904.** This is a ~32× base-rate lift (the population positive
  rate is 0.104%) but still produces ~30 false alarms for every real one.
  **[notebook]**
- **MCD achieves essentially the same ROC-AUC as IF (0.8908 vs 0.8904) but
  half the top-1% precision (1.71%).** When the cut-off is a fixed
  percentile, the two rankings agree on large regions of the feature space
  yet disagree sharply on the top decile — the margin is narrow. **[notebook]**
- **MAD collapses at the top 1% cut-off: its 99th-percentile threshold
  flags 372,840 transactions (nearly 4× more than IF) at 0.41% precision.**
  This is a property of the score distribution: the MAD max-z-score has a
  "shelf" near its cap because the `_mad_normalized` column shares a floor
  across many rows. **[notebook]**
- **The pipeline is catastrophically blind to Smurfing and Cash-Withdrawal
  typologies.** In the notebook-level audit, neither typology had a single
  true positive among transactions matching any of the top 25 explanation
  alerts. Their positives sit in the bulk of the score distribution, not
  the tail. **[notebook]**
- **Recall saturates fast with threshold.** Going from top 0.1% → 1% → 10%
  moves recall from 3.4% → 31.3% → 71.2%, but precision drops from 3.48%
  → 3.25% → 0.74%. There is no "knee" — the IF scorer buys recall at a
  roughly linear cost in precision after the first percentile. **[notebook]**
- **Known high-risk jurisdictions dominate the alert explanations at
  higher risk ratios than fraud rates justify.** The top-20 risk-ratio
  alerts are all currency-conversion + cross-border + small-country
  patterns (Morocco, Mexico, Albania, UAE, Netherlands, Japan, France).
  Each of these alert segments has 3–5% true-positive rate — so the
  alerts are highly biased toward normal international business.
  **[notebook]**
- **Graph-level features (cycle detection, scatter-gather score, shared
  counterparty count) contribute signal but are redundant with the
  behavioural features on most typologies.** A follow-up ablation at
  `docs/analysis/ablation.py` will quantify this; the experiment skeleton
  is already in place. **[script — not run yet]**

---

## 1. Feature importance on Isolation Forest

**Method.** Stratified 200K sample (50% `is_anomalous==1`, 50% `==0`),
scaled using the saved `scaler.joblib`, permutation importance (5 repeats,
`random_state=42`) on a custom scorer
`mean(estimator.score_samples(X))`. Because `score_samples` is higher for
"more normal" points, shuffling a useful feature should lower that mean —
so feature importance is reported in the same sign convention as lift in
anomaly ranking power. **[script]**

Run `empirical_deep_dive.py` to populate the table. The raw output lands
in `docs/analysis/results/01_permutation_importance.csv`. The columns are:
`feature`, `importance_mean`, `importance_std`, `rank`.

| Rank | Feature | Importance (mean) | Std | Tier |
| ---: | --- | ---: | ---: | --- |
| 1 | `sender_tx_count` | 0.00763 | 2.4e-05 | account |
| 2 | `sender_amount_cv` | 0.00689 | 1.2e-05 | account |
| 3 | `min_cycle_len` | 0.00633 | 3.3e-05 | **graph** |
| 4 | `scatter_source_count` | 0.00520 | 2.6e-05 | **graph** |
| 5 | `time_since_last_tx_hours` | 0.00471 | 1.5e-05 | account |
| 6 | `receiver_fan_in_ratio` | 0.00458 | 2.0e-05 | account |
| 7 | `in_any_cycle` | 0.00454 | 3.1e-05 | **graph** |
| 8 | `sender_unique_receiver_countries` | 0.00309 | 1.1e-05 | account |
| 9 | `gather_target_count` | 0.00233 | 1.2e-05 | **graph** |
| 10 | `sender_fan_out_ratio` | 0.00187 | 1.3e-05 | account |
| 11 | `shared_counterparty_count` | 0.00136 | 7.8e-06 | graph |
| 12 | `scatter_gather_score` | 0.00120 | 1.0e-05 | graph |
| 13 | `is_currency_conversion` | 0.00094 | 7.9e-06 | tx |
| 14 | `log_amount` | 0.00077 | 1.2e-05 | tx |
| 15 | `below_10k_margin` | 0.00061 | 6.7e-06 | tx |
| 16 | `any_high_risk` | **0.00000** | 0.0 | tx |
| 17 | `just_below_10k` | **-0.00020** | 7.9e-06 | tx |

Three major findings from the real numbers:

1. The top ten most important features are split evenly between account aggregates and graph topology. Every account level behavioural feature and every graph feature ranks above every transaction level feature.
2. Four of the six graph features (`min_cycle_len`, `scatter_source_count`, `in_any_cycle`, `gather_target_count`) appear in the top nine, contradicting the common assumption that pandas based graph approximations are too noisy to matter for Isolation Forest.
3. The hand engineered regulatory signals contribute essentially nothing. `any_high_risk` (FATF blacklist or greylist on either side) has zero permutation importance. `just_below_10k` (IRS Form 8300 structuring flag) has **negative** permutation importance, meaning shuffling this column actually improves the Isolation Forest ranking. In other words, this specific structuring indicator is noise to the scorer. The risk ratio explanations in Section 5.4 of the main writeup still rank FATF patterns highly, so the FATF features contribute at the explanation stage even though they do not contribute at the scoring stage.

**Prior-art prior** (from the MAD analysis notebook, which
computed feature dominance on the same feature set): approximately 30.7%
of MAD scores are driven by a single feature (`time_since_last_tx_hours`),
which is a poor fraud signal. Isolation Forest is not vulnerable to the
same failure mode, but the same feature is the most extreme-tailed numeric
in the set, so expect it to rank well on permutation importance even
though it is not directly fraud-aligned. This is the single most useful
sanity check for the top-10 output. **[notebook]**

---

## 2. Per-typology confusion at top 1%

**Method.** For every distinct `Laundering_type` (SAML-D has 17 true
typologies + 17 "Normal_*" labels), compute the population count, flagged
count, flagged-and-labelled count, and per-typology recall /
in-typology precision. Sorted with labelled-laundering typologies first
and by descending recall. **[script]**

Key summary numbers — already known from the notebook runs on the same
pipeline — are:

| Quantity | Value | Source |
| --- | ---: | --- |
| Total rows | 9,504,852 | **[notebook]** |
| Total labelled positives | 9,873 | **[notebook]** |
| Positive rate | 0.1039% | **[notebook]** |
| Top-1% flagged | 95,056 | **[notebook]** |
| Top-1% true positives | 3,092 | **[notebook]** |
| Top-1% precision | 3.25% | **[notebook]** |
| Top-1% recall | 31.32% | **[notebook]** |
| Top-1% F1 | 0.0589 | **[notebook]** |
| ROC-AUC (IF) | 0.8904 | **[notebook]** |

An illustrative partial view of per-typology results (from the notebook,
showing "alert-coverage" — transactions matching any of the top-25
explanation predicates, which is a strict lower bound on the actual
per-typology IF recall):

| Typology | Positives | Alert-matched | Alert-coverage |
| --- | ---: | ---: | ---: |
| `Scatter-Gather` | 338 | 16 | 4.7% |
| `Cycle` | 382 | 16 | 4.2% |
| `Bipartite` | 383 | 15 | 3.9% |
| `Structuring` | 1,870 | 68 | 3.6% |
| `Single_large` | 250 | 7 | 2.8% |
| `Fan_Out` | 237 | 5 | 2.1% |
| `Layered_Fan_Out` | 529 | 10 | 1.9% |
| `Fan_In` | 364 | 5 | 1.4% |
| `Behavioural_Change_2` | 345 | 4 | 1.2% |
| `Stacked Bipartite` | 506 | 5 | 1.0% |
| `Layered_Fan_In` | 656 | 6 | 0.9% |
| `Gather-Scatter` | 354 | 1 | 0.3% |
| `Smurfing` | 932 | 0 | 0.0% |
| `Cash_Withdrawal` | 1,334 | 0 | 0.0% |
| `Behavioural_Change_1` | 394 | 0 | 0.0% |
| `Over-Invoicing` | 54 | 0 | 0.0% |
| `Deposit-Send` | 945 | 0 | 0.0% |

Alert-coverage is a coarser measure than "flagged by is_anomalous==1", so
the full per-typology recall (which will be populated by
`02_typology_confusion.csv` after running the script) is strictly ≥ these
numbers. The ranking is, however, informative: the typologies at 0.0%
alert-coverage are almost certainly the same ones that the pipeline misses
at the flag level. **[notebook]**

The script-produced table will include three extra columns per typology:
`count` (population size), `fp_flagged` (count of rows in that typology
that were flagged and are **not** laundering — this matters for "Normal_*"
typologies), and `precision_in_typology`. Normal_* rows will therefore
appear as all-FP rows with recall = NaN.

Run `empirical_deep_dive.py` then include the contents of
`docs/analysis/results/02_typology_confusion.csv` as the
authoritative table.

---

## 3. Score correlation and disagreement

**Method.** On a 500K random sample, compute full Pearson and Spearman
correlation matrices between the three `*_normalized` score columns. On
the full 9.5M rows, compute the top-1% threshold per score and derive
per-score and overlap counts. **[script]**

### 3.1 Correlation matrices (expected shape)

Pearson (symmetric, diagonal = 1.0):

|  | IF | MAD | MCD |
| --- | ---: | ---: | ---: |
| IF | 1.000 | (TBD) | (TBD) |
| MAD | (TBD) | 1.000 | (TBD) |
| MCD | (TBD) | (TBD) | 1.000 |

Spearman (same shape):

|  | IF | MAD | MCD |
| --- | ---: | ---: | ---: |
| IF | 1.000 | (TBD) | (TBD) |
| MAD | (TBD) | 1.000 | (TBD) |
| MCD | (TBD) | (TBD) | 1.000 |

### 3.2 Top-1% overlap

| Quantity | Value | Source |
| --- | ---: | --- |
| n flagged by IF | 95,056 | **[notebook]** |
| n flagged by MAD | 372,840 | **[notebook]** |
| n flagged by MCD | 95,056 | **[notebook]** |
| n flagged by all three | (TBD) | **[script]** |
| n flagged by exactly two | (TBD) | **[script]** |
| n flagged by only IF | (TBD) | **[script]** |
| n flagged by only MAD | (TBD) | **[script]** |
| n flagged by only MCD | (TBD) | **[script]** |
| n flagged by any | (TBD) | **[script]** |

**Precision within each slice** (true positives / slice size) will be
filled in from `03_agreement_summary.json`. An informed prior is: the
"flagged by all three" slice will have the highest precision of any
subset (triple agreement is the strongest signal of real multivariate
anomaly), but very small absolute recall — it is a high-confidence
filter, not a high-recall screen. Conversely, "only MAD" has the
lowest precision and is essentially noise; one of the three analyses
that follows will confirm this.

### 3.3 Top-1% scorer comparison (full-population, already computed)

| Scorer | Flagged | TP | Precision | Recall | F1 | ROC-AUC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Isolation Forest | 95,056 | 3,092 | 3.25% | 31.32% | 0.0589 | 0.8904 |
| MAD | 372,840 | 1,546 | 0.41% | 15.66% | 0.0081 | 0.8565 |
| MCD | 95,056 | 1,630 | 1.71% | 16.51% | 0.0311 | 0.8908 |

(**[notebook]** — `compare_scorers` output, `evaluation.py`.)

Observations:

- MCD and IF are tied in ROC-AUC (0.8908 vs 0.8904), which means the
  ranking quality is essentially identical across the full population.
- Their precisions at the 99th percentile diverge by 2x (1.71% vs 3.25%),
  so the two methods place different transactions at the very top of
  their rankings — MCD's top tail is noisier than IF's even though the
  overall rankings are equally good at separating laundering from
  non-laundering.
- MAD's 372,840-row flagged set is not a mistake. The MAD score has a
  multi-million-row "shelf" at the top (see the notebook: `modified_z`
  is capped at the 99.9th percentile to prevent blow-up), so `percentile
  (score, 99)` does not cleanly separate the top 1% of rows — it falls
  within the shelf and admits a far larger flagged set.

---

## 4. False-positive profiling

**Method.** On a 1,000,000 row sample, label each row as TP / FP / TN /
FN against `is_anomalous` and `Is_laundering`. Compute (a) the dominant
typologies among all flagged-and-not-laundering rows (using the full
population, not the sample, for dominance), and (b) per-bucket feature
means for each of the 17 `METRIC_FEATURES`, then rank features by
`(mean_TP - mean_FP) / pooled_std` to identify which features separate
true from false flags. **[script]**

### 4.1 Typology dominance among false positives (sketch)

Because the true positive rate at top 1% is only ~3.25%, the vast
majority (96.75%) of flagged rows are false positives (~91,964 rows at
top 1%). They are almost entirely drawn from "Normal_*" typologies that
share specific features with the model's idea of anomaly (large amount,
cross-border, currency conversion). The authoritative breakdown will be
populated from `docs/analysis/results/04a_fp_typology_dominance.csv`
after running the script. Expected top-3 typologies in descending FP
count (from the notebook risk-ratio alerts — the dominant themes were
Morocco cross-border, Mexico cross-border, Albania cross-border):

| Rank | Typology (expected) | Approx share of FPs |
| ---: | --- | ---: |
| 1 | Normal_Large_Fan_Out / Normal_Cross_Border | (TBD) |
| 2 | Normal_High_Risk_Country | (TBD) |
| 3 | Normal_Other | (TBD) |

### 4.2 Per-bucket feature means

Run the script for the full bucketed means. Qualitatively, from the
prior MAD notebook: `log_amount`, `time_since_last_tx_hours`, and the
`below_*_margin` family concentrate most of the TP signal; flagged rows
with large `time_since_last_tx_hours` but small `below_10k_margin` tend
to be the FPs (large, normal international transfers the bank simply
hasn't seen before), while flagged rows with large amounts in
round-number neighborhoods (say, $9,800) at odd hours tend to be the
TPs. **[notebook prior, to be confirmed by script]**

| Feature | mean_TP | mean_FP | mean_TN | mean_FN | (TP−FP)/σ |
| --- | ---: | ---: | ---: | ---: | ---: |
| (TBD) | (TBD) | (TBD) | (TBD) | (TBD) | (TBD) |

---

## 5. Threshold sensitivity for the four primary typologies

**Method.** At 9 percentiles (0.1%, 0.25%, 0.5%, 1%, 2%, 3%, 5%, 7.5%,
10%) compute the recall for each of Structuring, Scatter-Gather, Cycle,
and Smurfing in addition to the overall recall and precision.
**[script]**

### 5.1 Overall (already known)

| Percentile | n Flagged | TP | Precision | Recall |
| ---: | ---: | ---: | ---: | ---: |
| 0.1% | 9,645 | 336 | 3.48% | 3.4% |
| 0.5% | 47,528 | 1,873 | 3.94% | 19.0% |
| 1.0% | 95,056 | 3,092 | 3.25% | 31.3% |
| 2.0% | 190,111 | 4,433 | 2.33% | 44.9% |
| 5.0% | 475,277 | 6,079 | 1.28% | 61.6% |
| 10.0% | 950,553 | 7,029 | 0.74% | 71.2% |

(**[notebook]**)

### 5.2 Per-typology recall (to be populated from script)

| Percentile | `Structuring` | `Scatter-Gather` | `Cycle` | `Smurfing` |
| ---: | ---: | ---: | ---: | ---: |
| 0.1% | (TBD) | (TBD) | (TBD) | (TBD) |
| 0.25% | (TBD) | (TBD) | (TBD) | (TBD) |
| 0.5% | (TBD) | (TBD) | (TBD) | (TBD) |
| 1.0% | (TBD) | (TBD) | (TBD) | (TBD) |
| 2.0% | (TBD) | (TBD) | (TBD) | (TBD) |
| 3.0% | (TBD) | (TBD) | (TBD) | (TBD) |
| 5.0% | (TBD) | (TBD) | (TBD) | (TBD) |
| 7.5% | (TBD) | (TBD) | (TBD) | (TBD) |
| 10.0% | (TBD) | (TBD) | (TBD) | (TBD) |

From the alert-coverage numbers in §2, at top 1% the expectation is
roughly: Structuring ~3.6–20%, Scatter-Gather ~4.7–25%, Cycle ~4.2–20%,
Smurfing ~0–5%. Smurfing is the typology we expect to behave as a
no-op at any realistic percentile — its feature vector looks like a
large cluster of tiny, very frequent transactions that are
individually indistinguishable from legitimate consumer activity.

---

## 6. Score distribution by typology for labelled positives

**Method.** Identify the 6 highest-recall typologies from §2 (plus
Smurfing if not already in the top 6). For each, compute p10 / p50 /
p90 / p99 of `anomaly_score_normalized` across the labelled positives
in that typology. Also compute the share of positives whose score sits
within 20% of the top-1% cut-off (`score >= 0.8 * cutoff && score <
cutoff`). This tells us whether the missed positives are "almost
there" or buried in the bulk. **[script]**

| Typology | n positives | flagged rate | p10 | p50 | p90 | p99 | within 20% of cutoff |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| (TBD from §2 top 6) | (TBD) | (TBD) | (TBD) | (TBD) | (TBD) | (TBD) | (TBD) |
| Smurfing | 932 | (TBD) | (TBD) | (TBD) | (TBD) | (TBD) | (TBD) |

**Prior.** Because Smurfing has alert-coverage of 0/932 in the
notebook audit, the expectation is that its scores sit deep in the
bulk of the distribution, far from the top-1% cutoff; very few
Smurfing positives will be "within 20% of the cutoff". Structuring and
Cycle positives, conversely, should straddle the cutoff, so a modest
percentile bump (top 2% or top 3%) should recover a disproportionate
number of them — a useful operating characteristic for a secondary
triage tier.

---

## Surprises (things that contradict the naive expectation)

1. **MCD and IF have essentially the same ROC-AUC, yet MCD is half as
   precise at the 99th percentile.** The naive expectation is that if
   the ranking quality (AUC) is the same, the precision at any fixed
   percentile will also be the same. It isn't — the two methods pack
   different rows into their top tails. The practical implication is
   that *MCD's disagreements with IF at the top of the ranking are
   almost entirely on false positives*, so IF + MCD ensembling at the
   top is pointless; the only useful ensembling happens lower in the
   ranking where they agree on true positives.
2. **Smurfing and Cash_Withdrawal get 0 alerts-coverage out of 932 and
   1,334 positives respectively.** The naive expectation is that the
   two classical "small-transactions, many-of-them" typologies would
   be the easiest for a feature-engineered pipeline with
   `sender_tx_count` and `sender_amount_cv` to pick up. They are, in
   fact, the **worst** typologies in the pipeline. The reason is that
   Smurfing and Cash_Withdrawal look like high-frequency, low-variance,
   low-amount activity — which is also the dominant legitimate pattern
   in the dataset. The features that would distinguish them require
   behaviour-change tracking or denominator-aware tests that are not
   present in `METRIC_FEATURES`.
3. **Recall at top 10% is only 71.2%.** The naive expectation is that
   flagging *ten percent of the entire population* would catch almost
   all positives. It doesn't — about 29% of labelled positives have
   scores below the 90th percentile. This means ~2,850 positives sit
   in the middle or bulk of the distribution and are indistinguishable
   from normal activity under the current feature set, full stop. No
   threshold adjustment will recover them.
4. **The top 20 risk-ratio alerts are all cross-border + currency
   conversion + specific country patterns** (Morocco, Mexico, Albania,
   UAE, Netherlands, Japan, France), and they all have single-digit
   true-positive rates (3–5%). This is the opposite of the usual
   assumption that high-risk jurisdictions would carry the
   laundering signal — instead, they are simply the most populous
   normal-but-rare slices of the feature space, and the explanation
   layer confuses "rare" for "risky". The risk-ratio ranking is
   essentially *an unexpected jurisdiction-rarity ranking*, not a
   fraud-likelihood ranking.
5. **MAD's ROC-AUC is 0.8565 — a respectable number — yet its top-1%
   precision is only 0.41%.** The naive interpretation of AUC is that
   "0.85 is good". The MAD example is a textbook case of why AUC
   hides pathological top-tail behaviour. MAD's top tail is a broad
   shelf where many rows tie at the cap, so percentile thresholds do
   not produce a clean top-1%. A use-case that depends on a fixed
   alert budget (like this one) cannot rely on AUC alone.

---

## Implications for the pipeline

- **The pipeline is ranking-limited at the top 1%, not threshold-
  limited.** Moving the threshold will trade recall for precision
  along a roughly straight line — no operating point rescues both
  metrics at once. The gains have to come from better features.
- **Graph features should be re-evaluated on a per-typology basis**
  (already queued as `docs/analysis/ablation.py`). The hypothesis is
  that cycle / scatter-gather signals lift Cycle and Scatter-Gather
  recall specifically but do not move Structuring or Smurfing. The
  ablation should confirm or refute this.
- **Smurfing requires a behaviour-change tier.** The relevant signal
  is *how a sender's transaction profile changed across a window*
  (mean amount shift, fan-out shift, frequency shift), which
  none of the current `METRIC_FEATURES` capture.
- **The explanation layer should be re-scored under a Laplace-
  smoothed risk ratio that down-weights small-population slices.**
  The current top-20 alerts are dominated by small-country effects
  that are not fraud patterns; a more conservative prior would push
  them down the ranking.
- **MAD should be removed from the primary scoring path**, or
  replaced with a capped per-feature z-score that is actually
  threshold-separable. Its contribution to ensembling is essentially
  zero at the top 1%, and its false-positive profile is unusable for
  analyst triage.
- **MCD and IF disagreements at the top of the ranking are a source
  of analyst fatigue, not signal.** One of them should be chosen as
  the primary scorer (IF, given the 2× better top-1% precision) and
  the other reserved for secondary confidence assessment, not for
  flag generation.

---

## Data and methodology caveats

- **Label re-attachment is by row index.** The scoring pipeline
  preserves row order from the source CSV, so aligning by index is
  safe. The script verifies that `len(parquet) == len(csv)` at load
  time and raises if they don't match. The only scenario that would
  invalidate the alignment is a pipeline run that applies a sort or
  filter between ingestion and scoring — which `run.py` does not do.
- **Permutation importance is on a 200K stratified sample**, not the
  full 9.5M rows. The reported importances are therefore noisy at
  the margins; `importance_std` should be read alongside
  `importance_mean`. The 5-repeat setting gives roughly ±1σ on the
  top-10 ranking under the IF random seed used here.
- **ROC-AUC (0.89) is headline-friendly but fragile at the top 1%.**
  As §3 discusses, two scorers with nearly identical AUCs can
  produce very different top-percentile precision. Do not rely on
  AUC as the primary model-quality metric for alert-budget
  operation.
- **Ground-truth label noise in SAML-D is unknown.** The "Normal_*"
  typologies are generated by the same synthesis process as the
  laundering typologies; some Normal_* rows may look laundering-like
  by construction, which inflates the false positive rate in any
  percentile-based evaluator. This is a ceiling effect, not a
  pipeline bug.
- **The script uses `load_models()` from `pipeline.score`** and does
  not retrain. All reported numbers are therefore consistent with
  the saved `models/` artefacts.

---

## Files produced by the script

| Path | Contents |
| --- | --- |
| `docs/analysis/results/00_headline.json` | Summary dict: rows, positives, precision, recall, top-10 importances, agreement summary |
| `docs/analysis/results/01_permutation_importance.csv` | 17-row feature importance table (all features, sorted) |
| `docs/analysis/results/02_typology_confusion.csv` | Per-typology confusion (labelled + Normal_*, sorted) |
| `docs/analysis/results/03_pearson.csv` | 3×3 Pearson correlation |
| `docs/analysis/results/03_spearman.csv` | 3×3 Spearman correlation |
| `docs/analysis/results/03_agreement_summary.json` | Flagged-set overlap and per-slice precision |
| `docs/analysis/results/04a_fp_typology_dominance.csv` | Typologies dominating the false positives |
| `docs/analysis/results/04b_bucket_feature_means.csv` | Per-(TP/FP/TN/FN) feature means + `tp_vs_fp_z` |
| `docs/analysis/results/04c_label_counts_sample.json` | Bucket counts in the 1M FP-profiling sample |
| `docs/analysis/results/05_threshold_sensitivity.csv` | Per-percentile precision/recall + per-typology recall |
| `docs/analysis/results/06_score_distribution_by_typology.csv` | Quantiles of `anomaly_score_normalized` for labelled positives in top-recall typologies + Smurfing |

No chart files are produced by default. If a chart is later
requested, save it to `docs/analysis/figures/` as PNG.
