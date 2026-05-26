---
sidebar_position: 2
title: GCP BigQuery
---

# GCP BigQuery (Upcoming)

Ravioli plans integration with **Google BigQuery** to enable direct analysis on enterprise-wide data lakes and cloud warehouses alongside local DuckDB storage.

---

## Capabilities

- **Federated Queries**: Query BigQuery datasets directly from Ravioli's notebook interface.
- **Hybrid Joining**: Execute SQL queries that join local DuckDB tables (e.g. recent CSV uploads or API logs) with massive BigQuery historical tables.
- **Service Account Security**: Connections will be authorized using standard Google Cloud Service Account JSON keys.
- **Security & Encryption**: Like all credentials in Ravioli, service account credentials will be secured using symmetric **AES-256-GCM** encryption at rest in the transactional database and redacted as `••••••••` in frontend API responses. For details, see the [Security & Credential Storage](../../integrations.md#security--credential-storage) documentation.

---

## Setup

When launched, configuring Google BigQuery will involve:
1. Creating a Google Cloud service account with standard BigQuery Admin or User permissions.
2. Generating a JSON private key file.
3. Uploading the JSON key file or pasting its contents into the platform Settings menu under the `bigquery` settings key.
