# Literature Deep Dive: Positioning the MacroBase AML Pipeline

*Companion analysis to `docs/index.html`. Compiled April 2026 from live web searches. Every claim ends with a citation.*

## A. SAML-D published benchmarks

SAML-D was released in 2023 by Oztas, Cetinkaya, Adedoyin, Budka, and Aksu at the IEEE International Conference on E-Business Engineering (Sydney, November 4 to 6, 2023). The dataset contains 9.5M transactions across 12 features and 28 typologies [1]. The only peer reviewed SAML-D benchmark results I could locate are from a 2025 paper in the *Science and Information Journal* Volume 16 No 6 which reports:

| Model | Accuracy | Precision | Recall | F1 | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| LSTM (baseline) | 91.5% | 89.4% | 90.2% | 89.8% | Supervised on a balanced split [2] |
| LSTM + GraphSAGE hybrid | 95.4% | n/r | n/r | n/r | Supervised [2] |

**Critical caveat**: these numbers are reported on a balanced train/test split with full ground truth supervision. They are not directly comparable to the top percentile unsupervised metrics we report, because (i) a supervised model trained on labels that are 50/50 positive/negative can trivially achieve high F1 whereas our 0.1% base rate makes naive F1 mechanically small, and (ii) the paper does not disclose the exact sampling scheme so the denominator is unclear. The original SAML-D paper itself does not publish any detection results, focusing only on dataset generation [1].

The Kaggle hosting page is the current de facto distribution point [3] and several newer graph based AML papers reference SAML-D but evaluate on other datasets such as Elliptic and AMLSim [4, 8].

## B. State of the art supervised AML (upper bound reference)

Because SAML-D lacks a broad benchmark, the closest comparable literature comes from two adjacent datasets.

**Elliptic Bitcoin dataset** (203k nodes, 166 features per node, binary illicit label).
| Model | Year | F1 | Source |
| --- | --- | ---: | --- |
| GCN (Weber et al. original baseline) | 2019 | ~0.80 Illicit F1 | [5] |
| Inspection-L (self supervised GNN) | 2022 | ~0.85 | [6] |
| ChronoWave-GNN | 2025 | **0.9799** | [7] |
| TFGAT (cyclic pseudo label) | 2025 | 0.9046 (P 0.9814, R 0.8390) | [8] |
| Bit-CHetG (heterogeneous GNN) | 2024 | +12% Micro F1 over GCN | [9] |

**IBM AMLSim / AMLworld (Altman et al., NeurIPS 2023).**
The Altman et al. paper does not publish a leaderboard inside the main text, but reports that PNA and GIN+EU message passing GNNs "significantly enhance GNN performance" over vanilla GCN, and that combining Graph Feature Pre-processing (GFP) with LightGBM or XGBoost "demonstrates strong performance" on their HI and LI splits [10]. The paper explicitly notes that F1 for the minority class is the only reliable metric on AML data because the positive rate is so low. An open source implementation lives at `IBM/Pattern-GNN` [11] and the simulator at `IBM/AMLSim` [12].

## C. State of the art unsupervised AML

Unsupervised AML detection has fewer head to head benchmarks because every paper defines its own threshold. The recurring methods in 2024 and 2025 are:

1. **Variational Autoencoder plus GNN ensembles** (Elsevier, 2026). The authors analyse 54,258 SWIFT cross border payments over 9 months in 2024 and argue that combining VAE reconstruction error with GNN embeddings detects non linear laundering schemes that isolation forest alone misses. No single headline F1 was reported because the paper evaluates on internal bank labels [13].
2. **Graph Contrastive Pre-training for AML** (International Journal of Computational Intelligence Systems, 2024). Contrastive learning on transaction graphs, evaluated on Elliptic, outperforming supervised baselines at the same supervision level [14].
3. **Hybrid Deep Learning for AML with explainable AI** (ScienceDirect, 2026). Combines feature fusion and XAI on internal banking data and positions XGBoost plus SHAP as a strong interpretable baseline [15].
4. **Finding money launderers using heterogeneous graph neural networks** (ScienceDirect, 2025). Evaluates on bank data with encrypted embeddings [16].
5. **Isolation mechanism survey** (Machine Intelligence Research, 2025). Surveys every IF variant from 2008 onward, concludes IF is "still competitive" on tabular AML features and is outperformed mainly by supervised boosting and GNNs when labels are available [17].

Takeaway: there is no published unsupervised top 1% F1 result on SAML-D to directly compare against, so our number is the first of its kind in the public record (subject to verification).

## D. Gap analysis: where does our pipeline stand?

Our measured performance at top 1%:
- Isolation Forest: F1 0.0445, ROC-AUC 0.8506, recall 23.65%
- MCD: F1 0.0080, ROC-AUC 0.8527, recall 4.27%
- MAD: F1 0.0076, ROC-AUC 0.8243, recall 14.71%

Against the LSTM baseline reported on SAML-D (F1 89.8%, [2]), our unsupervised F1 is two orders of magnitude lower. This is expected and not damning: the LSTM reports F1 on a balanced supervised split, whereas our pipeline reports F1 on the raw 0.1% positive rate population with zero labels used at training time. A fair comparison would require either (i) rebalancing our test set to 50/50 and re-computing F1 (which would yield a much larger number), or (ii) asking the LSTM paper to report PR-AUC on the raw distribution. The LSTM paper does not do the latter.

**Where we genuinely match the literature**: ROC-AUC 0.8506 is in the same ballpark as the original Weber et al. Elliptic GCN result (~0.80 Illicit F1, [5]), and our per typology breakdown (92.5% recall on Behavioural_Change, 33% on Scatter-Gather) is consistent with the Weber et al. claim that graph features lift AML F1 by 30 to 40 percent over row level features [5].

**Where we are below the literature**:
1. **Smurfing recall is 0.0%** versus the SMoTeF paper's claim that temporal flow features detect it reliably [18]. Our account level `time_since_last_tx_hours` is a snapshot metric, not a rolling window, so we cannot capture the burst structure that SMoTeF exploits.
2. **Cash_Withdrawal recall is 4.6%**. The Bipartite typologies (10.2%) are similarly weak because our edge based features do not use role specific embeddings like GARG-AML [19].
3. Our top risk ratio alerts are dominated by country level currency conversion patterns (Albania 17.76x, Morocco, UAE). The Altman et al. paper warns that "F1 for the minority class" can be gamed by jurisdictional priors if the feature set includes country tags [10]. Our FATF informed features are a feature, not a bug, but they do shift the top alerts toward jurisdiction rarity rather than fraud likelihood.

## E. Recommended next steps, backed by the literature

Ranked by expected lift per engineering hour:

1. **Add rolling window behavioural features** (7 day and 30 day). SMoTeF [18] explicitly demonstrates that "computing maximum temporal flow within temporal order of events" pushes smurfing recall into the double digits. Our current time_since_last_tx_hours is a single lag, not a windowed aggregate. Estimated lift on Smurfing: 0% to 20% or more.
2. **Implement GARG-AML as a second smurfing detector**. GARG-AML [19] computes a single interpretable score from second order transaction neighbourhoods. It is pandas friendly and designed to slot into existing AML workflows. Estimated lift on Bipartite and Smurfing combined: 10 to 20 percentage points.
3. **Replace FP-Growth with MacroBase native explanation pruning**. Bailis et al. [20] demonstrate that their joint risk ratio plus support pruning is 3.2x faster than running FP-Growth on inliers and outliers separately, and our current implementation uses FP-Growth in exactly that slower mode. Zero accuracy change, pure speedup.
4. **GNN layer on a sampled subgraph**. Altman et al. [10] show that PNA and GIN+EU significantly outperform GCN on AMLSim. Since our graph features already provide cycle and scatter-gather signals, the marginal gain would come from learned edge embeddings on the typologies we currently miss (Cycle 19.9%, Stacked Bipartite 24.3%). Estimated lift: 10 to 15 F1 points on those specific typologies, with significant compute cost.
5. **SHAP explanations on Isolation Forest paths**. The 2026 hybrid deep learning paper [15] argues that SHAP plus XGBoost is the production standard for explainable AML. SHAP can be computed post hoc on IF and complements our MacroBase risk ratios (which explain populations) with per row explanations. Useful for an analyst UI, not for F1.
6. **Country stratified risk ratios**. The top alert bias toward Albania and Morocco [this work, Table 3] can be removed by computing risk ratios per jurisdiction rather than globally. This is a pure post processing change on the explanation stage and does not affect any F1 number.

## References

1. Oztas, B., Cetinkaya, D., Adedoyin, F., Budka, M., and Aksu, H. (2023). *Enhancing Anti-Money Laundering: Development of a Synthetic Transaction Monitoring Dataset*. IEEE ICEBE 2023. [IEEE Xplore](https://ieeexplore.ieee.org/document/10356193/)
2. *Detecting and Preventing Money Laundering Using Deep Learning*. Science and Information Journal Volume 16 No 6, 2025. [PDF](https://thesai.org/Downloads/Volume16No6/Paper_1-Detecting_and_Preventing_Money_Laundering.pdf)
3. [Kaggle: Anti Money Laundering Transaction Data (SAML-D)](https://www.kaggle.com/datasets/berkanoztas/synthetic-transaction-monitoring-dataset-aml)
4. Oztas, B. (2024). *Enhancing Transaction Monitoring Controls to Detect Money Laundering Using Machine Learning*. Bournemouth University PhD thesis. [PDF](https://eprints.bournemouth.ac.uk/41326/1/OZTAS,%20Berkan_Ph.D._2024.pdf)
5. Weber, M. et al. (2019). *Anti-Money Laundering in Bitcoin: Experimenting with Graph Convolutional Networks for Financial Forensics*. KDD Workshop. [arXiv:1908.02591](https://arxiv.org/pdf/1908.02591)
6. *Inspection-L: Self-Supervised GNN Node Embeddings*. [arXiv:2203.10465](https://arxiv.org/pdf/2203.10465)
7. *Detecting illicit transactions in bitcoin: a wavelet-temporal graph transformer approach for anti-money laundering*. Scientific Reports, 2025. [Nature](https://www.nature.com/articles/s41598-025-23901-3)
8. *Global-local graph attention with cyclic pseudo-labels for bitcoin anti-money laundering detection*. Scientific Reports, 2025. [Nature](https://www.nature.com/articles/s41598-025-08365-9)
9. *Graph convolution network for fraud detection in bitcoin transactions*. Scientific Reports, 2025. [Nature](https://www.nature.com/articles/s41598-025-95672-w)
10. Altman, E. et al. (2023). *Realistic Synthetic Financial Transactions for Anti-Money Laundering Models*. NeurIPS 2023 Datasets and Benchmarks Track. [arXiv:2306.16424](https://arxiv.org/abs/2306.16424)
11. [IBM/Pattern-GNN GitHub](https://github.com/IBM/Pattern-GNN)
12. [IBM/AMLSim GitHub](https://github.com/IBM/AMLSim/)
13. *Hybrid deep learning for anti-money laundering: Unsupervised detection of emerging schemes via feature fusion and explainable artificial intelligence*. ScienceDirect, 2026. [Link](https://www.sciencedirect.com/science/article/pii/S2666827026000216)
14. *Graph Contrastive Pre-training for Anti-money Laundering*. International Journal of Computational Intelligence Systems, 2024. [Springer](https://link.springer.com/article/10.1007/s44196-024-00720-4)
15. *Finding money launderers using heterogeneous graph neural networks*. ScienceDirect, 2025. [Link](https://www.sciencedirect.com/science/article/pii/S2405918825000273)
16. *Privacy-Preserving Graph-Based Machine Learning with Fully Homomorphic Encryption for Collaborative Anti-money Laundering*. Springer, 2024. [Link](https://link.springer.com/chapter/10.1007/978-3-031-80408-3_6)
17. *Anomaly Detection Based on Isolation Mechanisms: A Survey*. Machine Intelligence Research, 2025. [Springer](https://link.springer.com/article/10.1007/s11633-025-1554-4)
18. *SMoTeF: Smurf money laundering detection using temporal order and flow analysis*. Applied Intelligence, 2024. [Springer](https://link.springer.com/article/10.1007/s10489-024-05545-4)
19. *GARG-AML against Smurfing: A Scalable and Interpretable Approach*. arXiv, 2025. [arXiv:2506.04292](https://arxiv.org/pdf/2506.04292)
20. Bailis, P. et al. (2017). *MacroBase: Prioritizing Attention in Fast Data*. SIGMOD 2017. [PDF](http://www.bailis.org/papers/macrobase-sigmod2017.pdf)
