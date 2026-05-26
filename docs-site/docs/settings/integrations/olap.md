---
sidebar_position: 1
title: OLAP
---

# OLAP Database Integrations

Ravioli is built for fast analytical query execution. It utilizes a hybrid approach, combining zero-latency local execution with cloud data warehouse synchronization.

---

## DuckDB (Default Local DWH)

Ravioli uses **DuckDB** as its default local Data Warehouse (DWH).

- **In-process Analytics**: DuckDB executes directly inside the application process as a library, avoiding database server network latency and query parsing overhead.
- **Embedded Storage**: All ingested assets (e.g. flat files, API extracts) are converted into DuckDB tables and written to a local `.db` file within the application directory.
- **Query Engine**: Supports advanced SQL features including Window functions, CTEs, and direct reads of Parquet, CSV, and JSON files.

---

## MotherDuck Cloud Integration (Natively Supported)

Ravioli integrates local DuckDB storage with MotherDuck's cloud data warehouse platform for central sharing and backup.

* **Configuration & Sync**: See the detailed **[MotherDuck Setup Guide](./olap/motherduck.md)** for connection endpoints, safe PII-stripping push mechanics, and syncing rules.

---

## GCP BigQuery (Upcoming)

Support is planned to connect to Google BigQuery, enabling queries on corporate datasets.

* **GCP Credentials**: See the **[BigQuery Guide](./olap/bigquery.md)** for service account credentials and hybrid query capabilities.

