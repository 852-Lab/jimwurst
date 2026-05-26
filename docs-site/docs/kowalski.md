---
sidebar_position: 4
title: AI Analyst - Kowalski
---

# AI Analyst: Kowalski

<p align="center">
  <img 
    src={require('@site/static/img/kowalski.png').default} 
    alt="Kowalski the AI Analyst" 
    style={{ 
      maxWidth: '300px', 
      borderRadius: '12px', 
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      border: '1px solid var(--ifm-color-emphasis-200)'
    }} 
  />
</p>

**Kowalski** is Ravioli's primary AI Data Analyst agent. Powered by **[LangChain](https://www.langchain.com/)** and implemented in [`Kowalski.py`](file:///Users/jimmypang/AIPassioneProjects/ravioli/src/ravioli/ai/Kowalski.py), Kowalski executes analytical workflows using models configured via the **[LLM Providers](./settings/integrations/llm-providers.md)** integrations page.

Kowalski contributes directly to two core activities:
* **[Analyses](./analyses.md)**: Autonomously drafts execution plans, writes optimized DuckDB SQL queries, self-corrects runtime errors, and synthesizes visual charts.
* **[Insights](./insights.md)**: Summarizes query results into clinical, high-impact bulleted signals ready for organization-wide publication.

---

## Persona & Demeanor

Kowalski is defined by a strict set of behavioral rules that ensure clinical reliability and an objective presentation of analytical outcomes:

* **Methodical & Precise**: Every response is focused on empirical evidence and statistical certainty. Emotional, speculative, or overly descriptive language is avoided in favor of quantifiable metrics.
* **Clinical Tone**: Summaries are structured to provide max 4–5 sentences of direct, high-impact findings (Bottom Line Up Front).
* **Analytical Signals**: Kowalski punctuates status updates and milestones with Polish analytical confirmations (e.g., *"Tak."*, *"Analiza zakończona."*, *"Zrozumiałem."*, *"Gotowe."*, *"Potwierdzam."*) to sign off on specific analytical checkpoints.

---

## Core Capabilities & Skills

Kowalski's capabilities are divided into five specialized pillars:

### 1. SQL Synthesis & Optimization
* **DuckDB Dialect**: Fully proficient in high-performance DuckDB SQL, capitalizing on window functions, CTEs, and specific array/struct operations.
* **Schema Mapping**: Rapidly interprets table schemas to establish join logic, identify keys, and isolate correct filters.
* **Query Hardening**: Synthesizes and self-corrects code before execution to ensure runtime stability.

### 2. Statistical Reasoning
* **Trend Analysis**: Uncovers patterns, anomalies, and multi-dimensional correlations within raw datasets.
* **Aggregations**: Computes statistical summaries (variance, standard deviations, means, and percentiles) to represent dataset distribution profiles accurately.

### 3. Advanced Data Visualization (VizOps)
* **Heuristic Selection**: Automatically determines the best visual display (Bar, Line, Pie, Scatter, etc.) based on data cardinality and type.
* **Color Theory & High Contrast**: Selects accessible, harmonious palettes suited for immediate frontend display.
* **Chart Payloads**: Outputs standardized JSON schemas optimized for rendering directly in the frontend via Chart.js.

### 4. Decision Intelligence
* **Intent Parsing**: Determines whether a question requires a basic textual summary or a multi-step analytical investigation.
* **Resource Optimization**: Strategically coordinates and swaps specialized models (e.g., leveraging translation/SQL models vs. general reasoning models) to minimize latency and RAM overhead.

### 5. Clinical Reporting
* **Insight Distillation**: Distills deep query results into precise, bulleted signals for business consumption.
* **Audit Trails**: Generates transparent, step-by-step logs of reasoning steps and query executions.

---

## Specialized Tools

Kowalski interacts with your data warehouse via a structured set of analytical tools:

| Tool | Purpose |
| :--- | :--- |
| `duckdb` | The main engine used to execute raw SQL queries against your local OLAP database. |
| `ingest_file` | Automates the staging and ingestion of external files (CSV, Parquet, JSON, XLSX) into DuckDB. |
| `inspect_table` | Investigates column names, types, and sample data to understand table schemas before writing queries. |

---

## Reusable Workflows

Kowalski standardizes complex analytical routines into three key workflows:

1. **`data_ingestion`**: A methodical pipeline for registering and validating new datasets, checking constraints, and producing schemas.
2. **`simple_data_analysis`**: Quick, conversational querying to extract singular metrics or answer targeted data questions.
3. **`deep_dive_analysis`**: Multi-stage investigations involving hypothesis formulation, data join assemblies, multi-query execution, and visual charting.

---

## Related Documentation

* **[Analyses](./analyses.md)**: Explore the primary analytical container and interface where Kowalski is deployed.
* **[Deep Dives](./analyses/deep-dives.md)**: Learn how Kowalski plans and executes autonomous, multi-step agent workflows.
* **[Knowledge Base](./knowledge.md)**: See how custom context documents are injected to ground Kowalski's analytical runs.
* **[OLAP (DuckDB)](./data/olap.md)**: Understand the database architecture Kowalski queries.
