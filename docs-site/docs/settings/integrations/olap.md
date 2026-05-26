---
sidebar_position: 1
title: OLAP
---

# OLAP Database Integrations

Ravioli is built for fast analytical query execution. It utilizes a hybrid approach, combining zero-latency local execution using **DuckDB** as its default local Data Warehouse (DWH) with cloud data warehouse synchronization.

- **In-process Analytics**: DuckDB executes directly inside the application process as a library, avoiding database server network latency and query parsing overhead.
- **Embedded Storage**: All ingested assets (e.g. flat files, API extracts) are converted into DuckDB tables and written to a local `.db` file within the application directory.
- **Query Engine**: Supports advanced SQL features including Window functions, CTEs, and direct reads of Parquet, CSV, and JSON files.

:::info Data Schema & Performance
For details regarding local DuckDB file structures, schema patterns, and query performance optimizations, see the **[OLAP Database Documentation](../../data/olap.md)**.
:::

---

## Data Versioning & Synchronization (Push/Pull)

To facilitate collaborative workflows and database backups, Ravioli implements a versioned synchronization model to push and pull dataset states between local engines and cloud data warehouses:

- **Push Sync**: Uploads local data assets, transformation schemas, and derived analytical tables to cloud data warehouses. It employs automated security rules to skip PII-flagged datasets.
- **Pull Sync**: Restores or synchronizes cloud tables down to the local DuckDB instance, comparing differences to transfer only delta changes (new, updated, or deleted rows).
- **Warehouse Support**: This functionality is natively supported using **MotherDuck**. The same push/pull sync architecture is actively planned for **Google BigQuery** and other cloud database providers in the future to offer a uniform data versioning interface.

---

## MotherDuck Cloud Integration (Natively Supported)

Ravioli integrates local DuckDB storage with MotherDuck's cloud data warehouse platform for central sharing and backup.

* **Configuration & Sync**: See the detailed **[MotherDuck Setup Guide](./olap/motherduck.md)** for connection endpoints, safe PII-stripping push mechanics, and syncing rules.

---

## GCP BigQuery (Upcoming)

Support is planned to connect to Google BigQuery, enabling queries on corporate datasets.

* **GCP Credentials**: See the **[BigQuery Guide](./olap/bigquery.md)** for service account credentials and hybrid query capabilities.

