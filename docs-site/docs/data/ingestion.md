---
sidebar_position: 1
title: Data Ingestion
---

# Data Ingestion

The **Data Ingestion** module is responsible for importing flat files, querying external APIs, and routing raw data safely into the OLAP database.

---

## 1. Flat Files

Ravioli supports uploading and parsing standard flat files:
- **CSV / TSV**: Standard tabular data.
- **Parquet**: Highly compressed, columnar files optimized for large datasets and fast querying.
- **JSON / JSONL**: Semi-structured document and event logs.
- **GPX (GPS Exchange Format)**: Location logs from athletic runs, walks, or cycling tracks. The parser automatically structures coordinates, elevation, and timestamps.

### Upload and Verification Flow
1. **Hashing**: Uploaded files are hashed to check for duplicate datasets.
2. **Buffering**: Files are temporarily written to a local staging directory.
3. **Pipeline Ingestion**: Tabular data is written into DuckDB tables, and ownership tags (`created_by`, `owner_id`) are logged in PostgreSQL.

---

## 2. API Ingestion

For dynamic datasets, Ravioli queries remote APIs directly:
- **Web Feature Service (WFS)**: Connects to geospatial servers to fetch point, line, or polygon geometries.
- **Relational Mapping**: Automatically flattens XML/JSON spatial feature lists into tabular records and loads them into DuckDB.

---

## 3. DLT Ingestion

:::info Upcoming Feature
Additional personal and corporate connectors are currently on the upcoming roadmap. This section outlines the planned pipeline architectures.
:::

Ravioli plans to leverage the **dlt** (data load tool) library to support schema-evolution-resilient pipelines for personal data exports:
- **Apple Health**: Fitness workouts, energy expenditure, and heart rate logs.
- **Spotify**: Stream histories, playlist catalogs, and listening durations.
- **LinkedIn**: Connection lists, message stats, and profile views.
- **Substack**: Subscriber growth lists and email open/click statistics.

### Schema Orchestration
- **Namespace Isolation**: Each connector will load data into isolated schemas (e.g. `s_spotify`) to avoid database catalog collisions.
- **Progress SSE**: Long-running API extractions will stream progress steps using Server-Sent Events (SSE).
