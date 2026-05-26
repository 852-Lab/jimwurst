---
sidebar_position: 1
title: OLAP Storage (DuckDB)
---

# OLAP Storage (DuckDB)

Ravioli's analytical core runs entirely in **DuckDB**, a high-performance, columnar OLAP database engine optimized for analytical query execution and complex data aggregations.

While transactional application states and user profiles reside in PostgreSQL, analytical data sources, ingested logs, and curated metric tables are stored and queried within local or cloud-hosted DuckDB databases.

---

## Architecture & Ephemeral Connections

To prevent database file lock contention and allow concurrent operations across multiple processes, Ravioli implements an **ephemeral connection model** via `DuckDBManager`:

*   **No Persistent File Locks**: Ephemeral connection context managers open, execute queries, and close connections immediately:
    ```python
    with duckdb_manager.connect() as conn:
        conn.execute("SELECT COUNT(*) FROM table")
    ```
*   **MotherDuck Integration**: If a MotherDuck cloud token is configured, Ravioli attaches the cloud instance (`md:ravioli`) to enable hybrid query execution, backing up, and sharing analytical results.

---

## Schema Isolation & Conventions

To keep the data warehouse organized, prevent name collisions, and enforce security policies, analytical tables are isolated across several dedicated schemas in DuckDB:

| Schema Name | Purpose | Example Datasets |
| :--- | :--- | :--- |
| `main` | Default schema for user-uploaded datasets. | CSV, TSV, and standard Excel worksheets. |
| `s_manual` | Fallback schema for custom manual uploads. | GPX route coordinates, non-standard XML streams. |
| `s_<connector>` | Isolated schemas for individual API/DLT pipelines. | `s_spotify` stream histories, `s_apple_health` fitness data. |
| `marts` | Curated analytical models ready for insight generation. | Cleaned user metrics, rolled-up time series data. |

---

## OLAP Sub-modules

Explore specific analytical capabilities:

1.  **[Data Ingestion](./olap/ingestion.md)**: Details the processes of extracting raw data, AI-based sheet validation, PII scanning, and streaming chunked data.
2.  **[Data Transformation](./olap/transformation.md)**: Describes the Extract, Contextualize, Load (ECL) process, semantic mapping, and LangChain integration.
