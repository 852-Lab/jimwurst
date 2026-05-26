---
sidebar_position: 2
title: Custom Notebooks
---

# Custom Notebooks

Ravioli features a cell-based, interactive notebook interface designed to let users explore and query their data warehouse.

---

## Notebook Structure

Notebook state is stored in PostgreSQL as a Jupyter-compatible JSON document under `app.analyses.notebook`:
- **Markdown Cells**: Capture operator queries, business notes, and instructions.
- **Code Cells**: Capture generated SQL statements, thoughts, and tabular query output details.

---

## Execution & Streaming

When a user submits a query:
1. **Server-Sent Events (SSE)**: The API streams the execution phases over `/api/v1/analyses/{id}/stream`.
2. **Real-time Tables**: The SQL runs against DuckDB, and the first 15 output rows are returned as a markdown table.
3. **Conversational Responses**: The LLM streams its final textual response to synthesize the data findings.

---

## In-place Editing & Re-runs

- **Re-run from Cell**: Modifying an earlier cell prompts the backend to delete downstream outputs and re-run the logic from that node forward.
- **Wedge Insertions**: Users can insert a new cell between two existing ones. The system interpolates floating database timestamps to maintain the correct execution sequence.
