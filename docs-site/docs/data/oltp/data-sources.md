---
title: app.data_sources
sidebar_label: data_sources
---

# `app.data_sources`

The `app.data_sources` table is the central metadata registry tracking all data assets ingested into Ravioli.

---

## Schema Field Definition

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` (Primary Key) | Unique identifier generated via `uuid.uuid4`. |
| `filename` | `VARCHAR(255)` (Required) | The local filename saved on disk in the staging buffer. |
| `original_filename` | `VARCHAR(255)` (Required) | The original name of the file uploaded by the user. |
| `content_type` | `VARCHAR(100)` (Required) | The MIME type of the uploaded file. |
| `size_bytes` | `BIGINT` (Required) | Total size of the file on disk. |
| `table_name` | `VARCHAR(255)` (Required) | The generated target table name inside DuckDB. |
| `schema_name` | `VARCHAR(100)` (Default: `main`) | The isolated DuckDB schema namespace target. |
| `row_count` | `INTEGER` (Optional) | Number of rows loaded during ingestion. |
| `description` | `TEXT` (Optional) | User description explaining the dataset. |
| `status` | `VARCHAR(50)` (Default: `pending`) | Pipeline state: `pending`, `completed`, `failed`. |
| `error_message` | `TEXT` (Optional) | Logs error strings if the ingestion pipeline fails. |
| `file_hash` | `VARCHAR(64)` (Indexed) | SHA-256 hash of the file, used to detect duplicate uploads. |
| `source_type` | `VARCHAR(50)` (Default: `file`) | Data ingress method: `file`, `wfs`. |
| `source_url` | `TEXT` (Optional) | Connection URL for external APIs (e.g. WFS endpoints). |
| `has_pii` | `BOOLEAN` (Default: `False`) | Identifies if the dataset contains sensitive PII fields. |
| `created_at` | `TIMESTAMP` | Upload timestamp. |
| `updated_at` | `TIMESTAMP` | Last metadata change timestamp. |
| `owner` | `UUID` (Foreign Key) | References the `app.user_groups.id` owning the data. |
| `created_by` | `UUID` (Foreign Key) | References the `app.users.id` who uploaded the dataset. |
| `updated_by` | `UUID` (Foreign Key) | References the `app.users.id` who modified the source. |
| `owner_id` | `UUID` (Optional) | Polymorphic ID link. |
| `owner_type` | `VARCHAR(50)` (Default: `user`) | Polymorphic owner categorization (`user` or `group`). |

---

## Duplicate Detection & Security Rules

1.  **File Hashing**: The `file_hash` field stores file signature fingerprints. If a user uploads a duplicate file, the pipeline aborts to avoid database inflation.
2.  **PII Controls**: If `has_pii` is flagged `True` by the scanner, Ravioli blocks this dataset from being pushed to MotherDuck or any cloud server.
