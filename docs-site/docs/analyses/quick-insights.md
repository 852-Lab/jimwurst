---
sidebar_position: 1
title: Quick Insights
---

# Quick Insights

**Quick Insights** are automated statistical profiles generated immediately upon data ingestion. They provide a quick overview of a dataset's structure, patterns, and quality warnings.

---

## Technical Flow

When a new dataset (CSV, Parquet, JSON) is uploaded to the warehouse, Ravioli executes a pre-configured profiling pipeline:

### 1. Data Cleaning and Type Casting
Before profiling, the dataset is cleaned to prevent calculation noise:
- **ID Columns**: Standard ID patterns (e.g., `_id`, `postcode`, `phone`) are detected and cast to categories or strings, preventing the calculator from computing meaningless averages.
- **Low-Cardinality Categories**: Text columns with fewer than 30 unique values are optimized to `category` types to save memory.

### 2. Statistical Profiling
Ravioli runs the `ydata-profiling` engine in minimal mode to analyze:
- Row and column dimensions.
- Missing values and zero counts.
- High-level skewness and correlations.

### 3. LLM Synthesis
The statistical profile is sent to the LLM agent, which maps the properties to `quick_insight_template.md` to produce a report with:
- **Key Findings**: Statistics and percentages highlighted in backticks.
- **Governance Assumptions**: Grounding rules for data validity.
- **Data Constraints**: Skewness warnings or empty columns.

Ravioli automatically suggests **3 follow-up prompts** to launch deeper conversational query sessions.
