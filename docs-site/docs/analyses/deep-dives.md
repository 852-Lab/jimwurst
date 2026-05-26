---
sidebar_position: 3
title: Deep Dives
---

# Deep Dives

:::info Upcoming Feature
**Deep Dives** are currently on the upcoming roadmap. This page outlines the planned design and features.
:::

**Deep Dives** represent the AI-powered version of custom notebooks, where the SQL agent executes complex multi-step routines to solve advanced analytical problems.

---

## Autonomous SQL Agent

The SQL agent queries the database schema and matches it against natural language queries:
- **Grounding**: Grabs column descriptions and any attached Knowledge Base documents to prevent hallucinations.
- **Self-Correction Loop**: If a query fails, the DuckDB error message is fed back to the LLM. The agent rewrites and re-executes the query automatically.

---

## Dynamic Visualizations

When generating visual reports:
- The agent appends a structured `[VIZ]` JSON block to the stream.
- The payload defines chart properties (e.g. types like bar, line, pie, labels, and datasets).
- The frontend parses this payload and renders interactive charts in the notebook output cell dynamically.
