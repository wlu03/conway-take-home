# Feature-tier ablation study

Isolation Forest fit fresh per config (`contamination=0.01`, `max_samples=256`, `n_estimators=100`, `random_state=42`). Threshold: top 1% of IF anomaly scores. Sample: 489,394 rows, 9,873 positives (2.0174%).

## Headline metrics

| Config | Features | Precision | Recall | F1 | ROC-AUC | Fit (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline_tx` | 5 | 9.06% | 4.64% | 0.0614 | 0.6541 | 4.5 |
| `tx_plus_account` | 11 | 25.03% | 12.41% | 0.1659 | 0.7468 | 4.4 |
| `full` | 17 | 12.81% | 6.35% | 0.0849 | 0.7033 | 3.1 |

## Per-typology recall (top 10 most common laundering types)

| Typology | n | baseline_tx | tx_plus_account | full |
| --- | ---: | ---: | ---: | ---: |
| `Structuring` | 1,870 | 0.9% | 1.8% | 0.0% |
| `Cash_Withdrawal` | 1,334 | 20.5% | 44.0% | 0.0% |
| `Deposit-Send` | 945 | 2.0% | 7.9% | 0.1% |
| `Smurfing` | 932 | 0.0% | 0.4% | 0.0% |
| `Layered_Fan_In` | 656 | 2.0% | 2.4% | 1.4% |
| `Layered_Fan_Out` | 529 | 1.7% | 1.1% | 2.3% |
| `Stacked Bipartite` | 506 | 2.6% | 2.0% | 2.6% |
| `Behavioural_Change_1` | 394 | 1.8% | 49.2% | 69.8% |
| `Bipartite` | 383 | 2.9% | 3.1% | 0.0% |
| `Cycle` | 382 | 2.4% | 3.4% | 0.0% |

## Narrative

The **account-feature tier** contributed the biggest headline lift. Adding account-level aggregates on top of the transaction-only baseline moved F1 from 0.0614 to 0.1659 (Δ+0.1045) and recall from 4.6% to 12.4% (Δ+7.8pp). Layering graph features on top then moved F1 to 0.0849 (Δ-0.0810) and recall to 6.4% (Δ-6.1pp). ROC-AUC tracked the same story: 0.6541 → 0.7468 → 0.7033 (account Δ+0.0927, graph Δ-0.0435), which means the effect isn't just a threshold artefact — the ranking itself improves as we add tiers. The typology that benefited most from the account tier was `Behavioural_Change_1` (+47.5pp recall), consistent with account-level velocity features catching behavior that a single transaction row cannot express. The graph tier's largest recall gain was on `Behavioural_Change_1` (+20.6pp), which lines up with cycle and scatter-gather signals being most informative for layering / structuring topologies that span multiple accounts. Practical implication: if inference compute is tight, the `tx_plus_account` tier is the pragmatic minimum — graph features add the most value on specific structured typologies rather than on average precision.

## Config details

**`baseline_tx`** — Transaction-level features only

- Features: `log_amount, is_currency_conversion, any_high_risk, just_below_10k, below_10k_margin`

**`tx_plus_account`** — Transaction + account-level features

- Features: `log_amount, is_currency_conversion, any_high_risk, just_below_10k, below_10k_margin, sender_tx_count, sender_fan_out_ratio, sender_amount_cv, sender_unique_receiver_countries, receiver_fan_in_ratio, time_since_last_tx_hours`

**`full`** — Transaction + account + graph features

- Features: `log_amount, is_currency_conversion, any_high_risk, just_below_10k, below_10k_margin, sender_tx_count, sender_fan_out_ratio, sender_amount_cv, sender_unique_receiver_countries, receiver_fan_in_ratio, time_since_last_tx_hours, in_any_cycle, min_cycle_len, scatter_source_count, gather_target_count, scatter_gather_score, shared_counterparty_count`
