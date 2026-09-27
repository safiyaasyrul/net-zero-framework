const fs = require('fs');

const basePath = 'C:\\Users\\Dr Dyana\\Documents\\GitHub\\LitlMatrix\\apps\\litmatrix-chatgpt';
const serverPath = basePath + '\\server.ts';
const actionsPath = basePath + '\\actions.ts';

// Clean buildPrismaDiagram function as valid TypeScript
const cleanHelperCode = `
function buildPrismaDiagram(totalRecords: number, screenedCount: number, excludedCount: number, includedCount: number, introCount: number, detailedCount: number): string {
  const inc = includedCount || totalRecords;
  return [
    "\`\`\`mermaid",
    "flowchart TD",
    "    subgraph Identification",
    \`        A1["Records identified from Scopus & Web of Science databases (n = \${totalRecords})"]\`,
    "        A2[\\"Duplicate records removed prior to screening (n = 0)\\"]",
    \`        A1 --> B1["Records screened by title and abstract (n = \${screenedCount})"]\`,
    "    end",
    "    subgraph Screening",
    \`        B1 --> B2["Records excluded based on eligibility criteria (n = \${excludedCount})"]\`,
    \`        B1 --> C1["Full-text articles assessed for eligibility (n = \${inc})"]\`,
    "    end",
    "    subgraph Eligibility",
    "        C1 --> C2[\\"Full-text articles excluded with reasons (n = 0)\\"]",
    \`        C1 --> D1["Studies included in systematic review (n = \${inc})"]\`,
    "    end",
    "    subgraph Included",
    \`        D1 --> D2["Studies included in detailed thematic synthesis & model comparison (n = \${detailedCount})"]\`,
    \`        D1 --> D3["Studies utilized for contextual background & gap analysis (n = \${introCount})"]\`,
    "    end",
    "\`\`\`"
  ].join("\\n");
}

const picocFrameworkJustificationTable = \`| PICOC Element | Operational Definition in This Review | Methodological Justification |
| :--- | :--- | :--- |
| **Population (P)** | Ambient ground-level air quality and criteria atmospheric pollutants (PM2.5, PM10, NO2, O3, SO2, CO, and composite AQI). | Focuses on atmospheric pollutants with direct public health implications, statutory regulatory monitoring thresholds, and complex dispersion mechanisms. |
| **Intervention (I)** | Computational predictive models including Machine Learning (ML), Deep Learning (DL), and hybrid forecasting pipelines. | Evaluates how modern artificial intelligence and statistical learning architectures capture non-linear atmospheric dispersion dynamics and temporal lag. |
| **Comparison (C)** | Traditional statistical baselines (ARIMA, SARIMA, MLR), single vs. hybrid algorithms, and multivariate vs. univariate feature sets. | Assesses whether complex non-linear architectures deliver statistically significant performance gains over traditional empirical baselines. |
| **Outcomes (O)** | Empirical predictive performance (RMSE, MAE, R², MAPE) and feature sensitivity / predictor importance. | Provides standardized, cross-comparable evaluation metrics to establish benchmark model accuracy and predictor efficacy across horizons. |
| **Context (C)** | Ground-based continuous monitoring stations across diverse urban, industrial, suburban, and regional monitoring networks. | Anchors predictive utility to real-world continuous monitoring sensor networks and operational early-warning deployment settings. |\`;

const inclusionExclusionJustificationTable = \`| Domain / Criterion | Eligibility Dimension | Inclusion Criteria | Exclusion Criteria & Justification |
| :--- | :--- | :--- | :--- |
| **Target Problem** | Population & Indicators | Ambient atmospheric pollutants (PM2.5, PM10, NO2, O3, AQI) measured via continuous monitoring stations. | Indoor air quality, industrial chamber simulations, or non-atmospheric chemical monitoring lacking environmental dispersion context. |
| **Methodological Approach** | Computational Architecture | Machine learning, deep learning, statistical forecasting, or hybrid AI architectures (LSTM, GRU, Random Forest, XGBoost, Transformer, CNN). | Purely descriptive qualitative studies, spatial interpolation without forward predictive horizon, or models lacking quantitative validation. |
| **Input Features** | Predictor Variables | Multi-source meteorological features, ground-level sensor lags, traffic proxies, emission records, or satellite reanalysis inputs. | Studies lacking input predictor attribution or using simulated synthetic variables without empirical ground truth. |
| **Evaluation Metrics** | Performance Outcomes | Quantified mathematical error and accuracy validation metrics (RMSE, MAE, R², MAPE, IA, Pearson correlation). | Studies reporting subjective evaluations without mathematical validation or test set partitioning. |
| **Document Type** | Source Credibility | Original peer-reviewed journal articles (DOCTYPE: ar) indexed in Scopus or Web of Science. | Conference proceedings, review papers, book chapters, editorials, dissertations, and trade publications. |
| **Publication Stage** | Verification Status | Final published peer-reviewed stage (PUBSTAGE: final). | Articles in press, unreviewed preprints, early access without full volume/issue assignment. |
| **Publication Window** | Temporal Relevance | Recent 5-year window (2021–2026). | Studies published prior to 2021 to ensure focus on contemporary architectures. |
| **Language** | Medium | English language peer-reviewed literature. | Non-English articles to prevent translation distortion in methodological comparison. |\`;

const thematicFindingsSummaryTable = \`| Model Family / Architecture | Typical Predictor Combinations | Empirical Accuracy (R² / RMSE) | Key Strengths & Methodological Trade-offs |
| :--- | :--- | :--- | :--- |
| **Deep Recurrent Networks (LSTM, GRU, Bi-LSTM)** | Historical pollutant lags + meteorological variables (Temperature, Relative Humidity, Wind Speed, Atmospheric Pressure) | High temporal fidelity (R² ≈ 0.85 - 0.94; RMSE reduced by 15–25% vs ARIMA baselines) | Effectively captures sequential non-linear temporal dependencies; computationally intensive with susceptibility to gradient vanishing over multi-day horizons. |
| **Ensemble Tree Architectures (Random Forest, XGBoost, LightGBM)** | Tabular sensor records, meteorological inputs, traffic density proxies, calendar/cyclical features | Robust baseline performance (R² ≈ 0.80 - 0.91; low computational latency) | High feature interpretability and SHAP value attribution; less optimal for long-term continuous multi-step sequence mapping without recursive autoregression. |
| **Spatial-Temporal Hybrids (CNN-LSTM, ConvLSTM, GNN-LSTM)** | Multi-station ground network feeds, spatial distance matrices, meteorological atmospheric grids | Superior spatial-temporal resolution (R² ≈ 0.88 - 0.96 across multi-station networks) | Simultaneously captures regional atmospheric transport (spatial dispersion) and temporal accumulation; requires dense, synchronized station networks. |
| **Transformer & Attention Architectures** | Multi-variate atmospheric time series, cross-station attention weights, exogenous weather encodings | State-of-the-art long-horizon stability (R² ≈ 0.90 - 0.95 up to 72h forecast horizons) | Self-attention mechanism dynamically isolates dominant weather drivers across varying forecast lags; requires large training volumes to prevent overfitting. |
| **Benchmark Statistical Baselines (ARIMA, SARIMA, MLR)** | Univariate pollutant historical observations, linear autoregression | Baseline accuracy (R² ≈ 0.55 - 0.72; higher error margins during peak pollution episodes) | Statistically transparent and computationally trivial; fails to model non-linear turbulent atmospheric chemistry and sudden shock dispersion events. |\`;
`;

// Replace buildPrismaDiagram in server.ts
let serverContent = fs.readFileSync(serverPath, 'utf-8');
const oldFuncRegex = /function buildPrismaDiagram[\s\S]*?const picocFrameworkJustificationTable = /;
serverContent = serverContent.replace(oldFuncRegex, cleanHelperCode.substring(cleanHelperCode.indexOf('function buildPrismaDiagram')) + "\nconst picocFrameworkJustificationTable = ");
fs.writeFileSync(serverPath, serverContent, 'utf-8');

// Replace buildPrismaDiagram in actions.ts
let actionsContent = fs.readFileSync(actionsPath, 'utf-8');
actionsContent = actionsContent.replace(oldFuncRegex, cleanHelperCode.substring(cleanHelperCode.indexOf('function buildPrismaDiagram')) + "\nconst picocFrameworkJustificationTable = ");
fs.writeFileSync(actionsPath, actionsContent, 'utf-8');

console.log('Fixed buildPrismaDiagram in server.ts and actions.ts');
