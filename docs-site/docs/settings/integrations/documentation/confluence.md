---
sidebar_position: 2
title: Confluence
---

# Confluence Integration (Upcoming)

Ravioli plans native integration with **Atlassian Confluence** to import and convert team spaces and pages into grounding documents for the AI model.

---

## Capabilities

### 1. Space & Page Imports
Admins will be able to specify target Confluence Space Keys or page IDs to synchronize. The integration will retrieve pages and children recursively to build local knowledge maps.

### 2. Format Normalization
Confluence uses storage format (XHTML-based) to save pages. Ravioli's sync engine will parse this structure, filter out unnecessary macros or styling containers, and convert the content into standard block-based JSON documents suitable for database indexing and prompt generation.

### 3. Scheduled Syncing
The platform will support setting automated schedules (cron expressions) to pull fresh documentation from Confluence regularly, keeping the AI's internal knowledge base aligned with wiki updates.

---

## Security & Credentials

Like all credentials in Ravioli, service credentials (such as Confluence personal access tokens or OAuth credentials) will be secured using symmetric **AES-256-GCM** encryption at rest in the transactional database and redacted as `••••••••` in frontend API responses. For details, see the [Security & Credential Storage](../../integrations.md#security--credential-storage) documentation.
