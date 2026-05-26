---
sidebar_position: 2
title: Custom Notebooks
---

# Custom Notebooks

Ravioli features a cell-based, interactive notebook interface designed to let users explore and query their data warehouse.

---

## Target Persona & Use Case

* **Who it is for**: **Advanced Users** (e.g., Data Analysts, Data Scientists, and Analytics Engineers) who require precise control over data transformations, queries, and coding logic.
* **The Goal**: To perform customized analyses, write complex queries, document analytical methodologies, and develop custom metrics.
* **Interaction**: A traditional notebook interface where operators write, arrange, and execute code and AI queries cell by cell.

---

## Notebook Structure & Cell Types

Notebook state is stored in PostgreSQL as a Jupyter-compatible JSON document under `app.analyses.notebook`. Each notebook is built using a sequence of specialized cell types:

### Markdown Cells
Used for documenting analytical methodologies, capturing business goals, and framing the analysis.
- **Support**: Standard Markdown syntax, including bolding, italicization, lists, code snippets, and embedded links.
- **Use Case**: Describing findings, detailing assumptions, or writing section headers to make the analysis reproducible and readable for others.

### SQL Cells
Enable direct querying of structured data assets attached to the analysis.
- **Execution Engine**: Runs directly against the local **DuckDB** file or remote **MotherDuck** warehouse.
- **Outputs**: Displays up to the first 15 query results in a live, formatted tabular view for immediate feedback.

### Python Cells
Provide the ability to run custom scripts, statistical calculations, and data formatting.
- **Environment**: Includes pre-installed data science packages (like `pandas`, `numpy`, and plotting libraries).
- **Use Case**: Advanced data transformations, math modeling, and custom chart plotting that go beyond standard SQL capabilities.

### AI Cells
Leverage LLM integration directly within the notebook flow.
- **Functionality**: Accepts natural language prompts to either generate code/SQL, analyze data tables, or summarize previous cell execution histories.
- **Use Case**: Translating plain English requirements into executable SQL or synthesizing visual patterns into text summaries.

---

## Execution & Streaming

When a user submits a query within the notebook:
1. **Server-Sent Events (SSE)**: The API streams the execution phases over `/api/v1/analyses/{id}/stream`.
2. **Real-time Tables**: The SQL runs against DuckDB, and the first 15 output rows are returned as a markdown table.
3. **Conversational Responses**: The LLM streams its final textual response to synthesize the data findings.

---

## In-place Editing & Re-runs

- **Re-run from Cell**: Modifying an earlier cell prompts the backend to delete downstream outputs and re-run the logic from that node forward.
- **Wedge Insertions**: Users can insert a new cell between two existing ones. The system interpolates floating database timestamps to maintain the correct execution sequence.
