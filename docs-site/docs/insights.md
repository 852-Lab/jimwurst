---
sidebar_position: 2
title: Insights & Analyses
---

# Insights & Analyses

In Ravioli, **Analyses** are interactive playgrounds where raw data is transformed into conversational business understanding. 

---

## 1. Quick Insights

When a new dataset (CSV, Parquet, JSON) is uploaded, Ravioli automatically pre-processes and casts the columns (e.g., distinguishing numeric metrics from ID categories) and executes a lightweight statistical profiling step using `ydata-profiling`.

The statistical summaries are synthesized by the LLM into a structured Markdown profile detailing:
- **High-Impact Metrics**: Key findings and statistics automatically highlighted.
- **Data Quality Alerts**: Warnings for empty values, constant columns, skewness, or zero inflation.
- **Grounding Assumptions**: The analytical bounds under which the dataset is valid.
- **Limitations**: Constraints regarding collection methods or sample sizes.

Ravioli also generates **3 high-impact follow-up questions** to initiate interactive analysis.

---

## 2. The Custom Notebook

Ravioli analyses feature a cell-based, interactive notebook interface saved in PostgreSQL as a Jupyter-compatible JSON structure:
- **Operator Cells**: Write plain-text or Markdown questions.
- **Kowalski Thought & SQL Cells**: The AI agent writes its reasoning and generates clean SQL queries.
- **Execution & Visualizations**: Queries run in real-time against DuckDB, streaming tabular results and charts back to the notebook.

### Server-Sent Events (SSE) Streaming
When you ask a question, the response streams live over `/api/v1/analyses/{id}/stream`. You see the SQL code being generated, the first 15 rows of the query output, and the final textual interpretation as they occur.

### In-Place Editing & Re-runs
If you modify a past question, Ravioli removes downstream cells and re-executes the notebook in-place. You can also insert new cells between existing ones; Ravioli automatically interpolates the database timestamps to preserve chronological order.

---

## 3. Custom Deep Dives

For complex, multi-step queries, the SQL generation agent operates with a **self-correction loop**. If a query fails, the error output is piped back to the LLM to rewrite the statement successfully.

When visualizing trends, the agent appends a structured `[VIZ]` JSON block to the end of the stream, rendering interactive charts (bar, line, scatter) dynamically in the user interface.
