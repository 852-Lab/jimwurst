---
sidebar_position: 3
title: Documentation
---

# Documentation Integrations

Ravioli integrates with external corporate knowledge bases and documentation platforms to ground its AI models and notebook execution contexts in your organization's business definitions, calculation rules, and analytical guidelines.

:::info Grounding & Storage
- **Knowledge Base**: For details on how imported pages are parsed, managed, and attached to analyses, see the **[Knowledge Base Documentation](../../knowledge.md)**.
- **Database Schema**: Synchronized blocks and document layouts are stored directly inside the **[`app.knowledge_pages` Table](../../data/oltp/knowledge-pages.md)**.
- **System Settings**: Integration tokens and configuration details are stored securely as encrypted JSON payloads inside the **[`app.system_settings` Table](../../data/oltp/system-settings.md)**.
:::

---

## Default (Local Mirror)

By default, Ravioli's local knowledge base is designed as a PostgreSQL-backed mirror table matching Notion's block-based data model. This enables the system to store and reference documents using Notion-compatible block trees natively within your local database without requiring any external cloud setup.

---

## Notion Sync

For teams utilizing Notion for their documentation, Ravioli supports connecting to the official Notion API. This enables full bi-directional page synchronization between your local PostgreSQL database mirror and your live cloud Notion workspaces.

* **Detailed Configuration**: For technical details, API endpoints, block tree structures, and sync sequences, see the **[Notion Setup Guide](./documentation/notion.md)**.

---

## Confluence (Upcoming)

Integration is planned to support importing and formatting documentation spaces from **Atlassian Confluence**.

* **Wiki & Space Setup**: See the **[Confluence Integration Guide](./documentation/confluence.md)** for information on space keys, layout formats, and scheduling updates.

