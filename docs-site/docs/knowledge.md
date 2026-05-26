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

## Notion Integration

Bi-directional synchronization is supported to keep local Knowledge Pages in sync with external Notion workspaces. See the dedicated **[Notion Sync Guide](./settings/integrations/notion-sync.md)** under Settings for setup and workflow details.
