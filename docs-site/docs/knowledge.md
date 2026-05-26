---
sidebar_position: 3
title: Knowledge Base
---

# Knowledge Base

:::info Technical Database Schema
For the transactional database fields and schema structures, refer to the **[`app.knowledge_pages` Table Documentation](./data/oltp/knowledge-pages.md)**.
:::

Barr Moses, CEO and co-founder of Monte Carlo, recently wrote that **"Powerful models are a simple API call away and available to all"** in [2026 Will Be The Year of Data + AI Observability](https://montecarlo.ai/blog-2026-will-be-the-year-of-data-ai-observability/). The implication for Ravioli is clear: the durable advantage is not access to LLMs alone, **but the unique context your organization captures, curates, and governs through its Knowledge Base.**

Ravioli lets teams manage domain-specific contexts to ground AI responses in reality. Your business terminology, calculations, operating logic, and decision history represent your competitive advantage, and keeping your AI agent aligned with this knowledge is crucial. Knowledge Pages work closely with **[Analyses](./analyses.md)**, where they can be attached as supporting context, and with **[Insights](./insights.md)**, where grounded conclusions are later reviewed and shared.

In Ravioli, the Knowledge Base is where that advantage becomes operational. It turns scattered institutional knowledge into reusable AI context that can be attached to analyses, shared across teams, and owned explicitly by the right contributors.

---

## Page Properties & Storage

Knowledge Pages are saved in the PostgreSQL schema under `app.knowledge_pages`. The data structures mimic Notion-compatible block trees (JSONB format) to maintain layout fidelity. Pages store:
- Page metadata (titles, icons, cover images).
- Parent-child hierarchical relationships.
- Rich-text blocks containing plain text, paragraph layouts, and formatted tables.

Ownership matters just as much as structure. Each Knowledge Page should remain attributable to the responsible **[User](./governance/users.md)** so teams know which contributor defined a term, updated a policy, or changed a business rule. That lineage becomes especially important when pages are shared across teams through **[Groups](./governance/groups.md)** or used to guide downstream analyses.

When an analysis is executed, attached Knowledge Pages are read, parsed into raw text strings, and injected directly into the LLM's system instructions to prevent the model from hallucinating. To understand where those runs happen, see **[Analyses](./analyses.md)** and the workflow details in **[Custom Notebooks](./analyses/custom-notebooks.md)** and **[Quick Insights](./analyses/quick-insights.md)**.

---

## Ownership & Contributors

Knowledge Pages are not anonymous prompts. They are governed assets with clear stewardship:

- The contributing **[User](./governance/users.md)** is responsible for creating and maintaining the page content that guides AI behavior.
- Ownership metadata such as `created_by`, `updated_by`, `owner_id`, and `owner_type` preserves accountability for every page revision.
- Ownership can remain with an individual contributor or be assigned to a shared **[Group](./governance/groups.md)** when the page represents team-managed knowledge.
- This governance model helps reviewers understand whose terminology, assumptions, and operating logic were used to ground an analysis.

---

## Notion Integration

Bi-directional synchronization is supported to keep local Knowledge Pages in sync with external Notion workspaces. See the dedicated **[Notion Sync Guide](./settings/integrations/documentation/notion.md)** under Settings for setup and workflow details, or browse the broader **[Integrations](./settings/integrations.md)** overview for related documentation connectors.

---

## Related Documentation

- **[Introduction](./intro.md)**: Start with the platform overview and navigation map.
- **[Analyses](./analyses.md)**: See how Knowledge Pages are attached to exploratory workflows.
- **[Insights](./insights.md)**: Follow how grounded analysis results become reviewed, publishable facts.
- **[Data](./data.md)**: Understand how source datasets enter Ravioli before they are analyzed with knowledge context.
- **[Integrations](./settings/integrations.md)**: Review external systems that extend Ravioli's AI and documentation capabilities.
- **[Notion Sync Guide](./settings/integrations/documentation/notion.md)**: Learn the technical details of syncing Knowledge Pages with Notion.
