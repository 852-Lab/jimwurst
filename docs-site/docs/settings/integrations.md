---
sidebar_position: 2
title: Integrations
---

# Integrations

:::info Technical Database Schema
For the transactional database fields and schema configurations, refer to the **[`app.system_settings` Table Documentation](../data/oltp/system-settings.md)**.
:::

Ravioli integrates with external platforms, large language model (LLM) hosts, cloud data warehouses, and documentation tools to expand its analytical capabilities, keep knowledge bases in sync, and execute scalable cloud queries.

---

## Security & Credential Storage

Handling sensitive credentials safely is a primary pillar of Ravioli's architecture. To prevent unauthorized access or token leakage, Ravioli implements the following security measures:

### 1. AES Encryption at Rest
All secrets, tokens, and API keys (e.g., MotherDuck tokens, Ollama Cloud keys, Notion integration keys) are encrypted using a secure symmetric **AES-256-GCM** encryption scheme before being written to the transactional database (`app.system_settings` table). The encryption key is sourced dynamically at runtime from environment variables.

### 2. Redacted API Deliveries
To prevent exposure of raw secrets over client-facing APIs:
- Any `GET` request to settings endpoints (e.g., `/api/v1/settings/{key}`) intercepts the payload and redacts sensitive field values, returning a dummy string: `••••••••`.
- When updating settings via `PUT` requests, the frontend sends `••••••••` if the secret was not changed. The backend detects this mask value and retains the existing encrypted database entry instead of overwriting it with dummy characters.

### 3. Connection Isolation
Connection tests (e.g., checking if the DuckDB/MotherDuck client can connect or pinging an Ollama instance) are executed in isolated backend worker threads to prevent slow network handshakes from blocking the main web server loop.

---

## Integration Subpages

Explore the detailed setup and technical specs for each category:

* **[LLM Providers](./integrations/llm-providers.md)**: Connect Ravioli's agent **Kowalski** to local Ollama nodes, Ollama Cloud deployments, or Google Gemini APIs.
* **[OLAP Databases](./integrations/olap.md)**: Configure the default in-process DuckDB engine, link cloud analytics with MotherDuck, or prepare for BigQuery.
* **[Documentation](./integrations/documentation.md)**: Ground your AI analyst in existing corporate manuals by importing Confluence pages or syncing **[Notion Pages](./integrations/notion-sync.md)**.
