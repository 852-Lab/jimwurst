---
sidebar_position: 2
title: Analyses
---

# Analyses

In Ravioli, **Analyses** are interactive playgrounds where data engineers and analysts query and explore data. They combine an interactive, cell-based interface with an autonomous SQL agent.

---

## The Custom Notebook

Ravioli analyses feature a cell-based execution environment similar to a Jupyter Notebook. The notebook structure is saved in PostgreSQL as a standard JSON document under the `notebook` column in the `app.analyses` table:
- **Operator Cells**: Store plain text questions or markdown comments.
- **Kowalski Thought & SQL Cells**: Store the AI's internal reasoning and the generated SQL queries.
- **Outputs**: Capture execution outputs, including live data tables and dynamic visualization charts.

### Real-Time Streaming via SSE
When a question is asked in the notebook, Ravioli communicates using Server-Sent Events (SSE) via the `/api/v1/analyses/{id}/stream` endpoint:
1. The question is logged, and the analysis status changes to `running`.
2. Kowalski generates a SQL query based on the active table schema, streaming the SQL text to the frontend cell.
3. The SQL is executed against the local DuckDB database, and the first 15 rows of results are converted to a markdown table and streamed to the notebook output.
4. The LLM processes the query results and streams a conversational answer back to the user.

### Re-runs and Insertions
- **In-Place Re-running**: Modifying an earlier cell removes downstream cells and runs the analysis from that cell forward.
- **Chronological Interpolation**: Inserting a cell between two existing ones calculates a floating timestamp to maintain the correct execution sequence in the database.

---

## Custom Deep Dives

For complex questions, Kowalski operates with a **self-correction loop**. If DuckDB throws a query execution error (e.g. invalid syntax or missing column), the error is fed back to the LLM to automatically generate a corrected SQL statement.

### Visualization Interceptor
If the user requests visual trends or distributions, the agent generates a visualization payload marked by a `[VIZ]` tag. The frontend intercepts this JSON block and dynamically renders interactive bar, line, or scatter charts directly in the notebook cell.
