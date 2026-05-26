---
sidebar_position: 4
title: Data (Assets)
---

# Data (Assets)

The **Data Assets** module handles ingestion, schema orchestration, and storage in the local OLAP database.

---

## Storage: DuckDB OLAP

While user accounts, governance permissions, and metadata are maintained in PostgreSQL (OLTP), all analytical queries run directly against a local **DuckDB** instance.

### Ephemeral Connection Pattern
DuckDB locks the database file (`.duckdb`) for writing, preventing multiple concurrent connections. To avoid read/write conflicts across API requests, Ravioli employs an **ephemeral connection model**:
- Every query opens a connection, executes, and immediately closes it.
- A central context manager (`duckdb_manager.connect()`) guarantees safety.
- An eager initialization thread warms up the database during boot to apply WAL logs before user requests hit.

---

## Python Ingestion via `dlt`

Data Ingestion is built on the **dlt** (data load tool) library, which automates schema detection, type coercion, and schema migration:
- **File Uploads**: Supports CSV, Parquet, JSON, and JSONL.
- **GPX Parser**: Extract location streams, latitude, longitude, and elevation from GPS files.
- **Personal Connectors**: Import structured data from Apple Health, Spotify, LinkedIn, and Substack.
- **Spatial WFS**: Sync external Web Feature Services (WFS) into DuckDB.

---

## Schema Isolation & Streaming

1. **Namespace Isolation**: Each ingested asset is isolated into its own DuckDB database schema (e.g., `s_spotify`, `s_google_sheet`) to prevent table name collisions.
2. **Progress-Tracked Ingestion**: Large files use the `/api/v1/data/upload/stream` endpoint, streaming execution logs via SSE so the frontend can display live pipeline phases.
