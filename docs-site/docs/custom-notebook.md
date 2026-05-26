---
sidebar_position: 4
title: Custom Notebooks
---

# Custom Notebooks

Ravioli blends professional-grade data warehouse operations with the iterative, cell-based interface of an interactive notebook. **Custom Notebooks** allow you to converse with your data, run SQL directly, build charts, and trace the logical path of your thoughts.

---

## Data Structure & Storage

Notebooks are stored inside the `app.analyses` table in PostgreSQL. The notebook content is represented as a structured JSON object (`notebook` field) that aligns with Jupyter (`.ipynb`) standards:

```json
{
  "cells": [
    {
      "cell_type": "markdown",
      "metadata": {},
      "source": [
        "### User Question\n",
        "What are the top 5 most played tracks?"
      ]
    },
    {
      "cell_type": "code",
      "metadata": {
        "log_type": "thought",
        "log_id": "8a3ef180-2bb1-4df2-a9e9-bb817db4bf20"
      },
      "outputs": [
        {
          "output_type": "stream",
          "text": "Based on the table schema, I will run a SQL query..."
        }
      ],
      "source": [
        "SELECT track_name, count(*) as play_count FROM main.spotify_streams GROUP BY 1 ORDER BY 2 DESC LIMIT 5"
      ]
    }
  ],
  "metadata": {},
  "nbformat": 4,
  "nbformat_minor": 5
}
```

---

## Streaming Execution via Server-Sent Events (SSE)

When a question is submitted to a notebook, Ravioli handles the request using Server-Sent Events (SSE) via the `/api/v1/analyses/{analysis_id}/stream` endpoint. This provides a highly responsive, real-time feel:

1. **User Query Node**: A cell is added to the notebook containing the user's question, and the analysis status shifts to `running`.
2. **SQL Generation and Execution**: The backend agent generates surgical SQL queries based on the database schema and streams them to the user.
3. **Live Table Output**: The query is executed against the local DuckDB database. The first 15 rows of the query results are formatted as a markdown table and streamed instantly to the frontend.
4. **Context Augmentation**: The query results are appended to the LLM's active context.
5. **Conversational Synthesis**: The LLM streams its final textual answer and suggestions to the user.
6. **Data Visualization**: If a chart is requested or relevant, a JSON visualization payload (e.g., chart types, labels, series data) is emitted at the end of the stream.

---

## In-Place Updates & Re-runs

Notebooks in Ravioli support advanced cell management:

- **Replace and Re-run**: By sending a `replace_log_id`, the user can modify a previous question cell. Ravioli automatically removes all downstream outputs associated with that execution step and re-executes the pipeline from that point.
- **Interpolated Insertions**: Users can insert a new cell between two existing ones. The backend calculates a floating timestamp strictly between the preceding cell (`insert_after_log_id`) and the succeeding cell to maintain a clean chronological execution flow.
