---
sidebar_position: 1
title: OLAP
---

# OLAP Database Integrations

Ravioli is built for fast analytical query execution. It utilizes a hybrid approach, combining local execution with cloud data warehouse synchronization.

---

## DuckDB (Default Local DWH)

Ravioli uses **DuckDB** as its default local Data Warehouse (DWH). 
- **In-process Analytics**: DuckDB executes directly inside the application process, providing extremely fast columnar queries on local file formats (e.g., CSV, Parquet, JSON) without database server overhead.
- **Embedded Storage**: Data assets are stored locally, making it ideal for offline analyses, single-machine operations, and rapid prototyping.

---

## MotherDuck

Ravioli integrates local DuckDB files with **MotherDuck's** cloud data warehouse.
- **Multi-Database Mode**: Automatically creates and mounts a cloud database (`ravioli`).
- **Sync Options**: Supports direct pushing and pulling of schemas and tables, using `EXCEPT` clauses to check for additions and deletions.
- **Bulk Sanitized Push**: Safeguards privacy by exporting only tables flagged as non-PII into a temporary local database, which is then uploaded in a single block operation.

---

## Google BigQuery (Upcoming)

Support is planned to connect to **Google BigQuery**, enabling teams to query enterprise data warehouses directly alongside their local DuckDB instances.
