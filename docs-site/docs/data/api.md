---
sidebar_position: 2
title: API Ingestion
---

# API Ingestion

For remote or dynamic data sources, Ravioli supports directly querying external APIs.

---

## Web Feature Service (WFS) Ingestion

Ravioli integrates with external geospatial servers to ingest Web Feature Service (WFS) layers:
- **XML/JSON Vectors**: The parser fetches point, line, or polygon spatial geometry lists over HTTP.
- **Relational Mapping**: Spatial rows are parsed, flattened, and converted into tabular datasets.
- **DuckDB Integration**: The parsed data is structured and written directly to DuckDB schemas, making it immediately available for relational querying.
