---
sidebar_position: 3
title: Knowledge Base
---

# Knowledge Base

Ravioli lets teams manage domain-specific contexts to ground AI responses in reality. Your business terminology, calculations, and strategies represent your competitive advantage, and keeping your AI agent aligned with this knowledge is crucial. Knowledge Pages work closely with **[Analyses](./analyses.md)**, where they can be attached as supporting context, and with **[Insights](./insights.md)**, where grounded conclusions are later reviewed and shared.

---

## Page Properties & Storage

Knowledge Pages are saved in the PostgreSQL schema under `app.knowledge_pages`. The data structures mimic Notion-compatible block trees (JSONB format) to maintain layout fidelity. Pages store:
- Page metadata (titles, icons, cover images).
- Parent-child hierarchical relationships.
- Rich-text blocks containing plain text, paragraph layouts, and formatted tables.

When an analysis is executed, attached Knowledge Pages are read, parsed into raw text strings, and injected directly into the LLM's system instructions to prevent the model from hallucinating. To understand where those runs happen, see **[Analyses](./analyses.md)** and the workflow details in **[Custom Notebooks](./analyses/custom-notebooks.md)** and **[Quick Insights](./analyses/quick-insights.md)**.

---

## Notion Integration

Bi-directional synchronization is supported to keep local Knowledge Pages in sync with external Notion workspaces. See the dedicated **[Notion Sync Guide](./settings/integrations/notion-sync.md)** under Settings for setup and workflow details, or browse the broader **[Integrations](./settings/integrations.md)** overview for related documentation connectors.

---

## Related Documentation

- **[Introduction](./intro.md)**: Start with the platform overview and navigation map.
- **[Analyses](./analyses.md)**: See how Knowledge Pages are attached to exploratory workflows.
- **[Insights](./insights.md)**: Follow how grounded analysis results become reviewed, publishable facts.
- **[Data](./data.md)**: Understand how source datasets enter Ravioli before they are analyzed with knowledge context.
- **[Integrations](./settings/integrations.md)**: Review external systems that extend Ravioli's AI and documentation capabilities.
- **[Notion Sync Guide](./settings/integrations/notion-sync.md)**: Learn the technical details of syncing Knowledge Pages with Notion.
