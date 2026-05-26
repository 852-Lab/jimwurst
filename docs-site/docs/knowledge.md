---
sidebar_position: 3
title: Knowledge Base
---

# Knowledge Base

Ravioli lets teams manage domain-specific contexts to ground AI responses in reality. Your business terminology, calculations, and strategies represent your competitive advantage, and keeping your AI agent aligned with this knowledge is crucial.

---

## Page Properties & Storage

Knowledge Pages are saved in the PostgreSQL schema under `app.knowledge_pages`. The data structures mimic Notion-compatible block trees (JSONB format) to maintain layout fidelity. Pages store:
- Page metadata (titles, icons, cover images).
- Parent-child hierarchical relationships.
- Rich-text blocks containing plain text, paragraph layouts, and formatted tables.

When an analysis is executed, attached Knowledge Pages are read, parsed into raw text strings, and injected directly into the LLM's system instructions to prevent the model from hallucinating.

---

## Notion Sync Integration

Ravioli integrates natively with Notion via the `NotionSyncService` to sync documents bi-directionally:

### 1. Import Sync (`Notion -> Ravioli`)
The service queries the Notion API to retrieve pages shared with the integration.
- **Timestamp Caching**: The system records the remote `last_edited_time` property. If the local version is already up-to-date, the sync process skips the page to minimize API calls.
- **Block Parsing**: The rich text elements and nested block structures of Notion are parsed recursively and saved in Ravioli's local database.

### 2. Export Push (`Ravioli -> Notion`)
When a local Knowledge Page is updated or generated from an approved analysis insight:
- **Overwrite Append**: Since the Notion API does not support full-document overwrites, Ravioli deletes the page's existing block tree and appends the new structure recursively.
- **Batch Processing**: Requests are batched into chunks of 100 blocks to comply with Notion API rate limits.
- **Conflict Management**: Pushes update the remote timestamp cached locally, preserving version alignment.
