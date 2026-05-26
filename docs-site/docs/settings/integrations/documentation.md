---
sidebar_position: 3
title: Documentation
---

# Documentation Integrations

Ravioli integrates with external corporate knowledge bases and documentation platforms to ground its AI models and notebook execution contexts in your organization's business definitions, calculation rules, and analytical guidelines.

---

## Notion (Default)

The primary documentation integration is **Notion**, which provides full bi-directional page synchronization.

- **Knowledge Sync**: Pages shared with the Notion integration token are parsed and stored as structured markdown block trees within Ravioli's Postgres database.
- **AI Grounding**: These documents are indexed and served to **Kowalski** (the AI Agent) to provide context on business terminology, KPIs, and operational formulas.
- **Detailed Configuration**: For technical details, API endpoints, and syncing limits, see the **[Notion Sync Guide](./notion-sync.md)**.

---

## Confluence (Upcoming)

Integration is planned to support import and formatting of documentation spaces from **Atlassian Confluence**:

- **Space Imports**: Admins will specify target Space Keys to import entire spaces or specific document trees.
- **Format Normalization**: Confluence Storage Format (XHTML) will be parsed and normalized into the standard block-based format used by Ravioli's knowledge base.
- **Scheduled Syncing**: Set cron schedules to periodically pull updates from Confluence and refresh the AI grounding model.
