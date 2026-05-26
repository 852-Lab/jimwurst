---
sidebar_position: 1
title: Flat Files
---

# Flat Files

Ravioli supports direct ingestion of flat files into the local OLAP database.

---

## Supported Formats

- **CSV / TSV**: Standard tabular text formats.
- **Parquet**: Standard highly compressed columnar storage, ideal for handling larger datasets with faster query speeds.
- **JSON / JSONL**: Semi-structured document and event logging logs.
- **GPX (GPS Exchange Format)**: Spatial logs from outdoor runs, walks, or bike rides. The backend automatically parses coordinates, elevation, and timestamps into structured relational rows.

---

## Upload and Validation Flow

1. **Hashing**: Uploaded files are immediately hashed to prevent duplicate dataset uploads.
2. **Buffering**: Files are temporarily written to a staging directory.
3. **Pipeline Loading**: The ingestion subsystem parses the dataset structures and writes them directly into DuckDB tables.
4. **Attribution**: Audit columns (`created_by`, `updated_by`, `owner_id`) are linked to the user account in PostgreSQL.
