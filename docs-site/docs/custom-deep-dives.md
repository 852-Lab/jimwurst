---
sidebar_position: 5
title: Custom Deep Dives
---

# Custom Deep Dives

**Custom Deep Dives** go beyond simple question-answering. They allow the user to execute complex, multi-step queries, generate automated visualizations, and solve advanced analytical problems over their data warehouse tables.

---

## The SQL Generation Agent

At the core of the Deep Dive experience is the SQL Agent. The agent is grounded with:
- **Database Schema Context**: The table names, columns, and data types from the active DuckDB catalog.
- **Contextual Knowledge**: Any business terms or definitions attached to the analysis.

### Self-Correction Loop
If the agent runs a generated SQL query and DuckDB returns an execution error, the error details are injected back into the LLM's prompt. The agent analyzes the syntax error or missing column warning and attempts to rewrite the query.

---

## Visualization Payload (`[VIZ]`)

When a user asks for trends, distributions, or comparisons, the agent generates a visualization payload along with its textual answer. The payload is sent as a special JSON token at the end of the SSE stream:

```json
[VIZ]{
  "type": "bar",
  "title": "Monthly Streaming Trends",
  "labels": ["Jan", "Feb", "Mar", "Apr"],
  "datasets": [
    {
      "label": "Play Count",
      "data": [120, 150, 180, 220]
    }
  ]
}
```

The frontend interceptor parses this token and renders interactive, beautiful charts (using Chart.js or equivalent components) directly inside the notebook cell outputs.

---

## Error Mitigation & Resilience

If the visualization generator or the query executor fails, Ravioli handles the failure gracefully:
- **Detailed Logs**: Log messages describe what went wrong (e.g. execution timeouts, database lock contentions, or chart generation errors).
- **Graceful Fallbacks**: The system renders a clear error panel within the notebook, and the conversational agent explains the failure and suggests alternative queries.
