---
sidebar_position: 2
title: Integrations
---

# Integrations

Ravioli integrates with external tools to expand its AI capabilities, sync knowledge bases, and connect cloud warehouses.

---

## 1. LLM Providers

Ravioli supports local and cloud LLM execution:

### Ollama Local (Default)
Runs LLMs locally on your machine.
- **Connection**: Typically hosted at `http://localhost:11434` or routed to `host.docker.internal` inside Docker containers.
- **RAM Management**: Employs an unload method (`unload_model`) to purge active models from system RAM/VRAM after completing an analysis task.

### Ollama Cloud
Connects to external, cloud-hosted Ollama endpoints using secure API Bearer tokens.

### Google Gemini (Upcoming)
Google AI Studio integration is planned to support Gemini models. This will allow Ravioli to utilize Gemini's massive 2-million token context window to process massive directories and reference manuals.

---

## 2. Documentations (Knowledge Bases)

### Notion (Default)
Provides bi-directional page syncing. See the dedicated **[Notion Sync Guide](./notion-sync.md)** for details on the technical import and export sync processes.

### Confluence (Upcoming)
Integration is planned to import documentation spaces and enterprise knowledge pages from Atlassian Confluence, formatting them into local Knowledge Base documents to ground the AI.

---

## 3. Data Warehouses

### MotherDuck (Default)
Integrates local DuckDB files with MotherDuck's cloud data warehouse.
- **Multi-Database Mode**: Automatically creates and mounts a cloud database (`ravioli`).
- **Sync Options**: Supports direct pushing and pulling of schemas and tables, using `EXCEPT` clauses to check for additions and deletions.
- **Bulk Sanitized Push**: Safeguards privacy by exporting only tables flagged as non-PII into a temporary local database, which is then uploaded in a single block operation.

### Google BigQuery (Upcoming)
Support is planned to connect to Google BigQuery, enabling teams to query enterprise data warehouses directly alongside their local DuckDB instances.
