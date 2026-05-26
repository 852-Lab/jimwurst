---
sidebar_position: 3
title: Quick Insights
---

# Quick Insights

**Quick Insights** are automated, high-fidelity statistical profiles designed to give data teams and business stakeholders immediate visibility into newly ingested datasets. Instead of waiting for manual exploratory data analysis (EDA), Ravioli generates comprehensive summaries instantly.

```mermaid
flowchart LR
    Ingest[Ingest File] --> Prep[Preprocess DataFrame]
    Prep --> Profile[ydata-profiling engine]
    Profile --> KeyInsights[LLM Key Insights]
    KeyInsights --> Suggestions[Suggested Follow-Up Prompts]
    Suggestions --> Notebook[Seed Custom Notebook]
```

---

## Technical Flow

When a user requests a Quick Insight for a data source, Ravioli performs the following steps:

### 1. Data Cleaning and Type Casting
The backend pre-processes the dataset using standard rules defined in `prepare_dataframe_for_analysis`:
- **ID Column Detection**: Pattern-matches common column suffixes (e.g., `_id`, `phone`, `zip`, `postcode`) and casts high-cardinality codes to strings, and low-cardinality ones to categorical. This prevents the statistical engine from generating meaningless average values for postal codes or user IDs.
- **Object Conversion**: Attempts to coerce columns typed as `object` (strings) to numeric types.
- **Categorical Optimization**: Columns with fewer than 30 unique string values are converted to the memory-efficient `category` type.

### 2. Statistical Profiling
Ravioli runs a statistical profiling step utilizing the `ydata-profiling` library (in minimal mode for execution speed) to extract:
- Column data types and null counts.
- Variables and cardinality.
- Advanced warnings/alerts (e.g., high correlations, constant values, extreme skewness, or zero inflation).
- Summary statistics (means, standard deviations, ranges, and frequencies).
- A representative sample of the first 10 rows.

### 3. LLM Synthesis
The statistical profile is formatted into a prompt and sent to the configured LLM agent. The agent uses `quick_insight_template.md` to output a clean markdown report structured with:
- **Dataset Properties**: Number of rows and columns, plus schema list.
- **Key Insights**: Standalone metrics and percentages are automatically parsed and highlighted in backticks for visibility.
- **Assumptions**: Critical constraints under which the statistical summary is valid.
- **Limitations & Known Issues**: Empty columns, skew warnings, or quality outliers.

---

## Suggested Prompts

To kickstart deeper investigations, the Quick Insight endpoint generates **3 high-impact follow-up questions** tailored to the data profile. Examples include:
- *"What are the primary drivers behind the observed volume concentration?"*
- *"Are there specific time periods where the anomalies are more prevalent?"*
- *"What is the impact of the identified limitations on the overall analysis?"*

These suggestions are offered in the user interface to seed interactive chat notebooks for custom deep dives.
